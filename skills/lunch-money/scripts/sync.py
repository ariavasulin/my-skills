#!/usr/bin/env python3
"""Lunch Money sync + write-back."""

from __future__ import annotations

import argparse
import json
import sqlite3
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import httpx

V1_BASE = "https://dev.lunchmoney.app/v1"
V2_BASE = "https://api.lunchmoney.dev/v2"

CONFIG_PATH = Path.home() / ".local/share/lunch-money/config.json"
DB_PATH = Path.home() / ".local/share/lunch-money/lm.db"


@dataclass
class Config:
    api_token: str
    db_path: Path = DB_PATH


def load_config() -> Config:
    if not CONFIG_PATH.exists():
        sys.exit(f"Missing config: {CONFIG_PATH}. Create it with {{\"api_token\": \"...\"}}.")
    data = json.loads(CONFIG_PATH.read_text())
    token = data.get("api_token")
    if not token:
        sys.exit(f"{CONFIG_PATH} has no 'api_token' field.")
    return Config(api_token=token)


SCHEMA = """
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    group_id INTEGER,
    group_name TEXT,
    is_income INTEGER DEFAULT 0,
    exclude_from_budget INTEGER DEFAULT 0,
    exclude_from_totals INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('asset','plaid')),
    institution_name TEXT,
    balance REAL,
    currency TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY,
    date TEXT NOT NULL,
    payee TEXT,
    amount REAL NOT NULL,
    currency TEXT,
    notes TEXT,
    category_id INTEGER REFERENCES categories(id),
    status TEXT,
    is_pending INTEGER DEFAULT 0,
    account_id INTEGER,
    account_type TEXT,
    recurring_id INTEGER,
    is_split_parent INTEGER DEFAULT 0,
    split_parent_id INTEGER,
    is_group INTEGER DEFAULT 0,
    group_id INTEGER,
    external_id TEXT,
    source TEXT,
    created_at TEXT,
    updated_at TEXT
);

CREATE TABLE IF NOT EXISTS transaction_tags (
    transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
    tag_id INTEGER REFERENCES tags(id),
    PRIMARY KEY (transaction_id, tag_id)
);

CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT
);

CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_tx_account ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_tx_payee ON transactions(payee);
"""


def init_db(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.executescript(SCHEMA)
    conn.commit()
    return conn


def make_client(cfg: Config) -> httpx.Client:
    return httpx.Client(
        headers={"Authorization": f"Bearer {cfg.api_token}"},
        timeout=30.0,
    )


def api_get(client: httpx.Client, url: str, params: dict | None = None) -> dict:
    """GET with rate-limit handling. Returns parsed JSON dict."""
    for attempt in range(5):
        resp = client.get(url, params=params)
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", "5"))
            print(f"  rate-limited; sleeping {wait}s", file=sys.stderr)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        return resp.json()
    sys.exit(f"Repeated rate-limit on GET {url}")


def api_put(client: httpx.Client, url: str, body: dict) -> dict:
    for attempt in range(5):
        resp = client.put(url, json=body)
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", "5"))
            time.sleep(wait); continue
        resp.raise_for_status()
        return resp.json() if resp.content else {}
    sys.exit(f"Repeated rate-limit on PUT {url}")


def api_delete(client: httpx.Client, url: str) -> None:
    for attempt in range(5):
        resp = client.delete(url)
        if resp.status_code == 429:
            time.sleep(int(resp.headers.get("Retry-After", "5"))); continue
        resp.raise_for_status()
        return
    sys.exit(f"Repeated rate-limit on DELETE {url}")


def api_post(client: httpx.Client, url: str, body: dict) -> dict:
    for attempt in range(5):
        resp = client.post(url, json=body)
        if resp.status_code == 429:
            time.sleep(int(resp.headers.get("Retry-After", "5"))); continue
        resp.raise_for_status()
        return resp.json() if resp.content else {}
    sys.exit(f"Repeated rate-limit on POST {url}")


def resolve_account(conn: sqlite3.Connection, name: str) -> tuple[int, str]:
    """Returns (id, type) where type is 'asset' or 'plaid'."""
    row = conn.execute(
        "SELECT id, type FROM accounts WHERE lower(name) = lower(?)", (name,)
    ).fetchone()
    if row:
        return row[0], row[1]
    rows = conn.execute(
        "SELECT id, type, name FROM accounts WHERE lower(name) LIKE lower(?)",
        (f"%{name}%",),
    ).fetchall()
    if len(rows) == 1:
        return rows[0][0], rows[0][1]
    if not rows:
        sys.exit(f"No account matching {name!r}")
    sys.exit(f"Ambiguous account {name!r}: matches {[r[2] for r in rows]}")


def resolve_category(conn: sqlite3.Connection, name: str) -> int:
    """Case-insensitive exact match first, then unique substring match."""
    row = conn.execute(
        "SELECT id FROM categories WHERE lower(name) = lower(?)", (name,)
    ).fetchone()
    if row:
        return row[0]
    rows = conn.execute(
        "SELECT id, name FROM categories WHERE lower(name) LIKE lower(?)",
        (f"%{name}%",),
    ).fetchall()
    if len(rows) == 1:
        return rows[0][0]
    if not rows:
        sys.exit(f"No category matching {name!r}")
    sys.exit(f"Ambiguous category {name!r}: matches {[r[1] for r in rows]}")


def resolve_tags(conn: sqlite3.Connection, names: str) -> list[int]:
    """Comma-separated names → list of tag IDs."""
    out = []
    for n in [s.strip() for s in names.split(",") if s.strip()]:
        row = conn.execute(
            "SELECT id FROM tags WHERE lower(name) = lower(?)", (n,)
        ).fetchone()
        if not row:
            sys.exit(f"No tag matching {n!r}. Create it in the UI first.")
        out.append(row[0])
    return out


def sync_categories(conn: sqlite3.Connection, client: httpx.Client) -> int:
    data = api_get(client, f"{V1_BASE}/categories", params={"format": "flattened"})
    rows = data.get("categories", [])
    cur = conn.cursor()
    cur.execute("DELETE FROM categories")
    for c in rows:
        cur.execute(
            """INSERT INTO categories
               (id, name, group_id, group_name, is_income,
                exclude_from_budget, exclude_from_totals)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                c["id"], c["name"],
                c.get("group_id"), c.get("group_name"),
                int(bool(c.get("is_income"))),
                int(bool(c.get("exclude_from_budget"))),
                int(bool(c.get("exclude_from_totals"))),
            ),
        )
    conn.commit()
    return len(rows)


def sync_tags(conn: sqlite3.Connection, client: httpx.Client) -> int:
    data = api_get(client, f"{V2_BASE}/tags")
    rows = data if isinstance(data, list) else data.get("tags", [])
    cur = conn.cursor()
    cur.execute("DELETE FROM tags")
    for t in rows:
        cur.execute("INSERT INTO tags (id, name) VALUES (?, ?)", (t["id"], t["name"]))
    conn.commit()
    return len(rows)


def sync_accounts(conn: sqlite3.Connection, client: httpx.Client) -> int:
    assets = api_get(client, f"{V1_BASE}/assets").get("assets", [])
    plaid = api_get(client, f"{V1_BASE}/plaid_accounts").get("plaid_accounts", [])
    cur = conn.cursor()
    cur.execute("DELETE FROM accounts")
    for a in assets:
        cur.execute(
            """INSERT INTO accounts (id, name, type, institution_name, balance, currency)
               VALUES (?, ?, 'asset', ?, ?, ?)""",
            (a["id"], a.get("display_name") or a["name"],
             a.get("institution_name"),
             float(a["balance"]) if a.get("balance") is not None else None,
             a.get("currency")),
        )
    for p in plaid:
        cur.execute(
            """INSERT INTO accounts (id, name, type, institution_name, balance, currency)
               VALUES (?, ?, 'plaid', ?, ?, ?)""",
            (p["id"], p.get("display_name") or p["name"],
             p.get("institution_name"),
             float(p["balance"]) if p.get("balance") is not None else None,
             p.get("currency")),
        )
    conn.commit()
    return len(assets) + len(plaid)


def sync_user(conn: sqlite3.Connection, client: httpx.Client) -> None:
    me = api_get(client, f"{V1_BASE}/me")
    set_sync_meta(conn, "primary_currency", me.get("primary_currency", ""))
    set_sync_meta(conn, "user_email", me.get("user_email", ""))
    set_sync_meta(conn, "budget_name", me.get("budget_name", ""))


def get_sync_meta(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM sync_meta WHERE key=?", (key,)).fetchone()
    return row[0] if row else None


def set_sync_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute(
        "INSERT INTO sync_meta (key, value) VALUES (?, ?) "
        "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        (key, value),
    )
    conn.commit()


def sync_transactions(conn: sqlite3.Connection, client: httpx.Client, full: bool) -> int:
    """Sync transactions with pagination. Incremental unless full=True."""
    params: dict[str, str | int] = {
        "limit": 500,
        "offset": 0,
        "include_pending": "true",
    }
    if not full:
        last = get_sync_meta(conn, "last_sync_at")
        if last:
            params["updated_since"] = last

    total = 0
    while True:
        data = api_get(client, f"{V2_BASE}/transactions", params=params)
        batch = data.get("transactions", [])
        if not batch:
            break

        cur = conn.cursor()
        for t in batch:
            cur.execute(
                """INSERT OR REPLACE INTO transactions (
                       id, date, payee, amount, currency, notes, category_id,
                       status, is_pending, account_id, account_type, recurring_id,
                       is_split_parent, split_parent_id, is_group, group_id,
                       external_id, source, created_at, updated_at
                   ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                    t["id"], t["date"], t.get("payee"),
                    float(t["amount"]) if t.get("amount") is not None else 0.0,
                    t.get("currency"), t.get("notes"),
                    t.get("category_id"),
                    t.get("status"),
                    int(bool(t.get("is_pending"))),
                    _account_id(t), _account_type(t),
                    t.get("recurring_id"),
                    int(bool(t.get("is_split_parent"))),
                    t.get("split_parent_id"),
                    int(bool(t.get("is_group"))),
                    t.get("group_id"),
                    t.get("external_id"), t.get("source"),
                    t.get("created_at"), t.get("updated_at"),
                ),
            )
            tx_id = t["id"]
            cur.execute("DELETE FROM transaction_tags WHERE transaction_id=?", (tx_id,))
            for tag_id in t.get("tag_ids") or []:
                cur.execute(
                    "INSERT OR IGNORE INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)",
                    (tx_id, tag_id),
                )
        conn.commit()
        total += len(batch)

        if len(batch) < params["limit"]:
            break
        params["offset"] = int(params["offset"]) + len(batch)

    set_sync_meta(conn, "last_sync_at", _utc_now_iso())
    return total


def _account_id(t: dict) -> int | None:
    return t.get("asset_id") or t.get("plaid_account_id")


def _account_type(t: dict) -> str | None:
    if t.get("asset_id"):
        return "asset"
    if t.get("plaid_account_id"):
        return "plaid"
    return None


def _utc_now_iso() -> str:
    from datetime import datetime, timezone
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def cmd_sync(args: argparse.Namespace) -> None:
    cfg = load_config()
    conn = init_db(cfg.db_path)
    with make_client(cfg) as client:
        print("Syncing categories...", end=" ", flush=True)
        n = sync_categories(conn, client); print(f"{n} rows")
        print("Syncing tags...", end=" ", flush=True)
        n = sync_tags(conn, client); print(f"{n} rows")
        print("Syncing accounts...", end=" ", flush=True)
        n = sync_accounts(conn, client); print(f"{n} rows")
        print("Syncing user...", end=" ", flush=True)
        sync_user(conn, client); print("done")
        mode = "full" if args.full else "incremental"
        print(f"Syncing transactions ({mode})...", end=" ", flush=True)
        n = sync_transactions(conn, client, full=args.full); print(f"{n} rows")
    conn.close()


def _build_update_body(args: argparse.Namespace, conn: sqlite3.Connection) -> dict:
    body: dict = {}
    if args.category:
        body["category_id"] = resolve_category(conn, args.category)
    if args.notes is not None:
        body["notes"] = args.notes
    if args.payee is not None:
        body["payee"] = args.payee
    if args.status:
        body["status"] = args.status
    if args.tags is not None:
        body["tag_ids"] = resolve_tags(conn, args.tags) if args.tags else []
    return body


def _update_one(client: httpx.Client, conn: sqlite3.Connection, tx_id: int, body: dict) -> None:
    api_put(client, f"{V1_BASE}/transactions/{tx_id}", {"transaction": body})
    _apply_local_update(conn, tx_id, body)


def cmd_update(args: argparse.Namespace) -> None:
    cfg = load_config()
    conn = init_db(cfg.db_path)
    body = _build_update_body(args, conn)
    if not body:
        sys.exit("Nothing to update — pass at least one of --category/--notes/--payee/--status/--tags")
    with make_client(cfg) as client:
        _update_one(client, conn, args.id, body)
    print(f"Updated transaction {args.id}: {body}")
    conn.close()


def cmd_bulk_update(args: argparse.Namespace) -> None:
    cfg = load_config()
    conn = init_db(cfg.db_path)
    body = _build_update_body(args, conn)
    if not body:
        sys.exit("Nothing to update")
    ids = [int(x) for x in args.ids.split(",") if x.strip()]
    with make_client(cfg) as client:
        for i in ids:
            _update_one(client, conn, i, body)
    print(f"Updated {len(ids)} transactions: {body}")
    conn.close()


def _apply_local_update(conn: sqlite3.Connection, tx_id: int, body: dict) -> None:
    cols = []
    vals: list = []
    for k in ("category_id", "notes", "payee", "status"):
        if k in body:
            cols.append(f"{k} = ?")
            vals.append(body[k])
    if cols:
        vals.append(tx_id)
        conn.execute(f"UPDATE transactions SET {', '.join(cols)} WHERE id = ?", vals)
    if "tag_ids" in body:
        conn.execute("DELETE FROM transaction_tags WHERE transaction_id = ?", (tx_id,))
        for tid in body["tag_ids"]:
            conn.execute(
                "INSERT INTO transaction_tags (transaction_id, tag_id) VALUES (?, ?)",
                (tx_id, tid),
            )
    conn.commit()


def cmd_delete(args: argparse.Namespace) -> None:
    cfg = load_config()
    conn = init_db(cfg.db_path)
    with make_client(cfg) as client:
        api_delete(client, f"{V2_BASE}/transactions/{args.id}")
    conn.execute("DELETE FROM transaction_tags WHERE transaction_id = ?", (args.id,))
    conn.execute("DELETE FROM transactions WHERE id = ?", (args.id,))
    conn.commit()
    print(f"Deleted transaction {args.id}")
    conn.close()


def cmd_create(args: argparse.Namespace) -> None:
    cfg = load_config()
    conn = init_db(cfg.db_path)
    acct_id, acct_type = resolve_account(conn, args.account)
    body: dict = {
        "date": args.date,
        "payee": args.payee,
        "amount": args.amount,
    }
    if acct_type == "asset":
        body["asset_id"] = acct_id
    else:
        body["plaid_account_id"] = acct_id
    if args.category:
        body["category_id"] = resolve_category(conn, args.category)
    if args.notes:
        body["notes"] = args.notes
    if args.tags:
        body["tag_ids"] = resolve_tags(conn, args.tags)
    if args.currency:
        body["currency"] = args.currency

    with make_client(cfg) as client:
        resp = api_post(client, f"{V1_BASE}/transactions",
                        {"transactions": [body], "apply_rules": True})
    ids = resp.get("ids") or []
    if not ids:
        sys.exit(f"Create returned no IDs: {resp}")
    new_id = ids[0]
    with make_client(cfg) as client:
        sync_transactions(conn, client, full=False)
    print(f"Created transaction {new_id}")
    conn.close()


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="sync.py")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_sync = sub.add_parser("sync", help="Sync from Lunch Money")
    p_sync.add_argument("--full", action="store_true", help="Full resync (ignore last_sync_at)")
    p_sync.set_defaults(func=cmd_sync)

    p_update = sub.add_parser("update", help="Update one transaction")
    p_update.add_argument("id", type=int)
    p_update.add_argument("--category")
    p_update.add_argument("--notes")
    p_update.add_argument("--payee")
    p_update.add_argument("--status", choices=["reviewed", "unreviewed"])
    p_update.add_argument("--tags", help="Comma-separated tag names (empty string clears)")
    p_update.set_defaults(func=cmd_update)

    p_bulk = sub.add_parser("bulk-update", help="Update many transactions")
    p_bulk.add_argument("--ids", required=True, help="Comma-separated IDs")
    p_bulk.add_argument("--category")
    p_bulk.add_argument("--notes")
    p_bulk.add_argument("--payee")
    p_bulk.add_argument("--status", choices=["reviewed", "unreviewed"])
    p_bulk.add_argument("--tags")
    p_bulk.set_defaults(func=cmd_bulk_update)

    p_del = sub.add_parser("delete", help="Delete a transaction")
    p_del.add_argument("id", type=int)
    p_del.set_defaults(func=cmd_delete)

    p_new = sub.add_parser("create", help="Create a transaction")
    p_new.add_argument("--date", required=True, help="YYYY-MM-DD")
    p_new.add_argument("--payee", required=True)
    p_new.add_argument("--amount", required=True, type=float, help="Positive = debit")
    p_new.add_argument("--account", required=True, help="Account name (asset or plaid)")
    p_new.add_argument("--category")
    p_new.add_argument("--notes")
    p_new.add_argument("--tags")
    p_new.add_argument("--currency")
    p_new.set_defaults(func=cmd_create)

    args = parser.parse_args(argv)
    args.func(args)


if __name__ == "__main__":
    main()
