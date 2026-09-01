---
name: lunch-money
description: "Manage personal finances via Lunch Money — review and categorize transactions, search spending, analyze by category/merchant/period, edit and tag transactions. Use when the user mentions Lunch Money, transactions, spending, finances, budget review, or categorizing purchases."
---

# Lunch Money

Local-first finance management. Syncs Lunch Money v2 API → SQLite at `~/.local/share/lunch-money/lm.db`. Query via `sqlite3`, edit via `sync.py` write-back commands.

## Setup (one-time)

1. Install httpx:
   ```bash
   pip3 install --user httpx
   # macOS Homebrew Python rejects this (PEP 668) — use:
   pip3 install --user --break-system-packages httpx
   ```
2. Get an API token at https://my.lunchmoney.app/developers
3. Create the config file:
   ```bash
   mkdir -p ~/.local/share/lunch-money
   echo '{"api_token": "PASTE_TOKEN_HERE"}' > ~/.local/share/lunch-money/config.json
   ```
4. Run initial sync:
   ```bash
   python3 ~/.claude/skills/lunch-money/scripts/sync.py sync
   ```

## Sync

Always run sync at the start of a finance session.

```bash
# Incremental (changes since last sync)
python3 ~/.claude/skills/lunch-money/scripts/sync.py sync

# Full resync (rebuilds transactions table from scratch)
python3 ~/.claude/skills/lunch-money/scripts/sync.py sync --full
```

## Querying the database

The local DB is at `~/.local/share/lunch-money/lm.db`. Use `sqlite3` in bash for all reads. Set this once per session:

```bash
DB=~/.local/share/lunch-money/lm.db
alias lmq='sqlite3 -header -column "$DB"'
```

### Schema cheat sheet

- `transactions(id, date, payee, amount, currency, notes, category_id, status, is_pending, account_id, account_type, recurring_id, is_split_parent, split_parent_id, is_group, group_id, external_id, source, created_at, updated_at)`
- `categories(id, name, group_id, group_name, is_income, exclude_from_budget, exclude_from_totals)`
- `tags(id, name)`
- `accounts(id, name, type, institution_name, balance, currency)`
- `transaction_tags(transaction_id, tag_id)`
- `sync_meta(key, value)` — keys: `primary_currency`, `last_sync_at`, `user_email`, `budget_name`

**Sign convention**: positive `amount` = money out (debit). Income is negative.

### Common queries

```sql
-- Uncategorized in last 7 days
SELECT t.date, t.payee, printf('%.2f', t.amount) AS amt, a.name AS account
FROM transactions t
LEFT JOIN accounts a ON a.id = t.account_id
WHERE t.category_id IS NULL
  AND t.date >= date('now', '-7 days')
  AND t.is_pending = 0
ORDER BY t.date DESC;

-- Payee search
SELECT date, payee, printf('%.2f', amount) AS amt
FROM transactions
WHERE payee LIKE '%costco%' COLLATE NOCASE
ORDER BY date DESC LIMIT 20;

-- Monthly spending by category
SELECT strftime('%Y-%m', t.date) AS month,
       c.name AS category,
       printf('%.2f', SUM(t.amount)) AS spent
FROM transactions t
JOIN categories c ON c.id = t.category_id
WHERE c.is_income = 0 AND c.exclude_from_totals = 0
GROUP BY month, c.name
ORDER BY month DESC, spent DESC;

-- Top merchants this month
SELECT payee, printf('%.2f', SUM(amount)) AS spent, COUNT(*) AS n
FROM transactions
WHERE date >= date('now', 'start of month')
  AND amount > 0
GROUP BY payee
ORDER BY SUM(amount) DESC
LIMIT 15;

-- Period comparison: this month vs last
SELECT
  printf('%.2f', SUM(CASE WHEN date >= date('now', 'start of month') THEN amount ELSE 0 END)) AS this_month,
  printf('%.2f', SUM(CASE WHEN date >= date('now', 'start of month', '-1 month')
                           AND date <  date('now', 'start of month') THEN amount ELSE 0 END)) AS last_month
FROM transactions
WHERE amount > 0;

-- Transactions with tags
SELECT t.date, t.payee, printf('%.2f', t.amount), GROUP_CONCAT(tg.name, ',') AS tags
FROM transactions t
JOIN transaction_tags tt ON tt.transaction_id = t.id
JOIN tags tg ON tg.id = tt.tag_id
GROUP BY t.id
ORDER BY t.date DESC LIMIT 20;
```

## My Context

> Populated after first sync. Update when accounts/categories/conventions change.

- **Primary currency**: USD
- **Sign convention**: positive `amount` = money out (debit). Income rows are negative.
- **Accounts** (all Plaid-synced):
  - 334239 — Wells Fargo Clear Access Banking ...6996 (checking)
  - 334244 — Charles Schwab Investor Checking
  - 334245 — Charles Schwab Individual (brokerage)
  - 334246 — Discover it chrome Card (credit)
- **Categories I use most**: (free-form notes — e.g. "Groceries vs Dining Out vs Coffee — Costco is always Groceries, even non-food")
- **Tagging conventions**: (free-form — e.g. "date-night, reimbursable, taxes-2026")

## Write-Back Reference

All edits go through `sync.py` (API call + local DB update). Categories and tags resolve by name — case-insensitive exact match, then unique substring.

```bash
SYNC=~/.claude/skills/lunch-money/scripts/sync.py

# Update one
python3 $SYNC update <id> [--category NAME] [--notes "..."] [--payee "..."] \
                          [--status reviewed|unreviewed] [--tags "a,b"]

# Update many (same field values)
python3 $SYNC bulk-update --ids 1,2,3 [--category NAME] [--notes "..."] [--status ...] [--tags "..."]

# Delete (irreversible)
python3 $SYNC delete <id>

# Create
python3 $SYNC create --date 2026-05-14 --payee "Coffee" --amount 5.50 \
                     --account "Chase Checking" [--category "Dining Out"] \
                     [--notes "..."] [--tags "..."] [--currency usd]
```

### Workflow: Review uncategorized transactions

1. **Sync**:
   ```bash
   python3 ~/.claude/skills/lunch-money/scripts/sync.py sync
   ```

2. **List uncategorized** (use the SQL from "Common queries").

3. **Categorize one at a time** for ambiguous ones; **bulk** for obvious groups (all Spotify charges → Subscriptions, all Costco → Groceries).

4. **Mark reviewed** as you go (or in a final bulk pass).

5. **Re-sync** at the end to confirm round-trip:
   ```bash
   python3 ~/.claude/skills/lunch-money/scripts/sync.py sync
   ```

## Limitations

- **Rules + recurring-item CRUD**: UI-only. No API. Cannot create or edit rules from this skill.
- **Net worth history**: No API endpoint. Net-worth analysis must be done in the Lunch Money UI.
- **CSV import**: UI-only.
- **Splits**: not yet wrapped. Use v1 split endpoint directly if needed.
- **Attachments**: not yet wrapped.

## Edge Cases & Gotchas

- **Splits and groups**: rows have `is_split_parent` / `is_group` flags. Use them when totaling spending to avoid double-counting (parent + children).
- **Pending transactions**: `is_pending = 1`. Filter them out of categorization workflows — amount and payee may change when they post.
- **Rate limit**: 100 req/min shared across v1+v2. `sync.py` handles 429 with `Retry-After`. First full sync of multi-year history may take a minute.
- **Stale local data**: if you edit in the Lunch Money UI between syncs, run `sync.py sync` before any write-back to avoid clobbering UI edits.
- **Token rotation**: regenerated token → update `~/.local/share/lunch-money/config.json` and re-run sync.
- **Tags don't auto-create**: `--tags "newtag"` fails if the tag doesn't already exist. Create new tags in the Lunch Money UI first.
- **Account name ambiguity**: if two accounts have similar names, `--account` may error — use the full distinct name.
- **Category groups**: cannot assign a group-level category to a transaction, only leaf categories. If `resolve_category` matches a group, the API will reject it.
