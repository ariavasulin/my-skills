# my-skills

Canonical source for Aria's personal Claude Code and Codex skills. Real skill files live under `skills/`; the runtime directories point back here with symlinks so both agents load the same content and a fresh machine can restore the complete personal set from this repository.

Plugin-owned skills such as `atlas-cloud`, `apify-cli`, `infographic`, `orca`, and `orchestration` remain owned by `~/.agents/skills` and are intentionally not copied here.

## What's here

- The shared artifact harness: `create-*`, `iterate-*`, implementation, worktree, and PR-description skills.
- Demo-native planning: `plan-research-questions` → `plan-research` → `plan-design` → `plan-author` → `plan-implement`.
- Personal utilities and integrations: `fanout`, `lunch-money`, `seedance-ads`, and `use-spark`.
- The Claude `plan-implementer` agent used by `plan-implement`.

## The Demo-native planning front-end

demo has a strong durable plan *contract* (`plans/`), a strong native implementation playbook (`plans/IMPLEMENTATION.md`), and a strong automated *back-half* (peprkit `ship` / `review-cycle`), but no driven front-end that walks you from a vague task through research and design to a plan — and then through phased implementation against that plan. These skills fill that gap. They feel like rpi (which I like), but the artifacts are native demo: a `plans/` contract, worked one phase at a time through demo's own `plans/IMPLEMENTATION.md`, so there's zero friction at the boundary with the seniors' workflow. Commit/PR (`/peprkit:ship`, `/peprkit:review-cycle`) stay a handoff to peprkit, not a fork.

Design principle: **minimal diff from the rpi originals — only the parts that would clash with peprkit/demo are changed.**

## The flow

```
/plan-research-questions  →  /plan-research  →  /plan-design  →  /plan-author
   (blind questions)          (blind answers)     (OPEN-question     (native demo plans/
                                                   design gate)        contract)
                                                                          │
                                          handoff ─────────────────────────┤
                                                          /peprkit:spawn-worktree
                                                                          │
                                          /plan-implement  ──spawns──→  plan-implementer  (agent)
                                          (phased orchestrator;          (implements one phase
                                           defers to plans/                at a time)
                                           IMPLEMENTATION.md)
                                                                          │
                                                          /peprkit:ship  +  /peprkit:review-cycle
```

| Skill | Forked from | What changed |
|---|---|---|
| `plan-research-questions` | rpi `create-research-questions` | rename + next-step pointer → `/plan-research` |
| `plan-research` | rpi `create-research` | rename + pointer → `/plan-design`; self-contained, keeps the blind-research firewall, does not touch peprkit `research-codebase` |
| `plan-design` | rpi `create-design-discussion` | rename + resolved-pointer → `/plan-author`; keeps OPEN-question human gate |
| `plan-author` | rpi `create-plan` | writes a demo `plans/active/` AC-contract (AC IDs + `Steps`/`Verify`/`Exit`) instead of a `.humanlayer/tasks` checkbox plan; hands off to `/peprkit:spawn-worktree` + `/peprkit:ship` instead of `/rpi:setup-worktree` |
| `plan-implement` | rpi `implement-plan` | reads a git-tracked `plans/active/` contract instead of a `.humanlayer/tasks` checkbox plan; defers to demo's `plans/IMPLEMENTATION.md` for session-entry / divergence / phase-exit / retro instead of restating the loop; spawns the `plan-implementer` agent (below); checkpoints per the demo git workflow and hands off commit/PR to `/peprkit:ship` + `/peprkit:review-cycle` instead of `/rpi:describe-pr` |

It also ships one agent, forked from rpi's `riptide-rpi-terminal` `implementer-agent`:

| Agent | Forked from | What changed |
|---|---|---|
| `plan-implementer` | rpi `implementer-agent` | implements one `plans/active/` phase against its AC-tagged `Verify` items (not a `thoughts/shared/plans/` checkbox plan); classifies divergence and **reports, never resolves**, contract questions per `plans/IMPLEMENTATION.md` § Delegation; verifies with demo commands (`poe -C python test`, `npm --prefix app run lint`) instead of `make check test` |

Intermediate docs (questions / research / design) land in the `.artifacts/` store (a repo-local symlink to the orca workspace's `.artifacts-store`), under a task directory named `YYYY-MM-DD-<ticket-or-slug>` — date-prefixed, kebab-case (e.g. `.artifacts/2026-07-03-eng-1478-parent-child-tracking/`). The plan and its implementation live in git-tracked `plans/active/` and the worktree branch.

## Restore or relink

Run this from the repository root. It links every repo-owned skill into both runtimes. Existing physical directories are reported and left untouched so recovery never overwrites unsaved skill edits; reconcile those directories into this repo first, then rerun.

```bash
skills_repo="$PWD"

for runtime_root in "$HOME/.claude/skills" "$HOME/.codex/skills"; do
  mkdir -p "$runtime_root"
  for skill_source in "$skills_repo"/skills/*; do
    skill_name=$(basename "$skill_source")
    skill_target="$runtime_root/$skill_name"
    if [ -e "$skill_target" ] && [ ! -L "$skill_target" ]; then
      echo "physical directory needs reconciliation: $skill_target"
      continue
    fi
    ln -sfn "$skill_source" "$skill_target"
  done
done

mkdir -p "$HOME/.claude/agents"
ln -sfn "$skills_repo/agents/plan-implementer.md" "$HOME/.claude/agents/plan-implementer.md"
```

Claude Code and Codex follow the skill-directory symlinks, so `{SKILLBASE}/references/...` continues to resolve inside each package. Claude also follows the agent-file symlink. Codex agent definitions use their own TOML format and remain runtime-managed.

## Relationship to the upstream harnesses

- **rpi** — the fork source. These supersede the rpi `create-*` and `implement-plan` commands (and the `implementer-agent`) for demo work.
- **peprkit** — untouched. `plan-research` coexists with peprkit `research-codebase` (this one is blind/in-pipeline; that one is general/ad-hoc). `plan-implement` runs *inside* a peprkit/orca worktree — after `spawn-worktree`, before `ship` — and forks only rpi's per-phase implement loop; the back-half (`spawn-worktree`, `ship`, `review-cycle`) stays a handoff, not a fork.
- **demo `plans/`** — the output and execution target. `plan-author` reads `plans/refs/authoring.md` + `plans/AGENTS.md` as the authoritative *authoring* contract; `plan-implement` and the `plan-implementer` agent read `plans/IMPLEMENTATION.md` as the authoritative *working* contract (session entry, divergence, phase exit, retro).
