# my-skills

Personal, global Claude Code skills — a **planning-and-implementation front-end** for the `demo` codebase, forked from the rpi (`riptide-rpi`) pipeline and adapted so its artifacts are native to the team's **peprkit + demo** harness.

## Why this exists

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

Intermediate docs (questions / research / design) still land in `.humanlayer/tasks/<task>/` (unchanged — the cloud-permalink hooks still fire). The plan and its implementation live in git-tracked `plans/active/` and the worktree branch.

## Install (symlink into the global `~/.claude/` dirs)

Real files live here; each skill directory — and the `plan-implementer` agent — is symlinked into `~/.claude/` (the same pattern as the `orca` skill):

```bash
# Skills → ~/.claude/skills/
for s in plan-research-questions plan-research plan-design plan-author plan-implement; do
  ln -sfn "$PWD/skills/$s" ~/.claude/skills/"$s"
done

# Agent → ~/.claude/agents/  (plan-implement spawns this per phase)
ln -sfn "$PWD/agents/plan-implementer.md" ~/.claude/agents/plan-implementer.md
```

Claude Code follows the directory symlink (and the agent-file symlink), so `{SKILLBASE}/references/...` resolves and the `plan-implementer` subagent is discoverable by `subagent_type`.

## Relationship to the upstream harnesses

- **rpi** — the fork source. These supersede the rpi `create-*` and `implement-plan` commands (and the `implementer-agent`) for demo work.
- **peprkit** — untouched. `plan-research` coexists with peprkit `research-codebase` (this one is blind/in-pipeline; that one is general/ad-hoc). `plan-implement` runs *inside* a peprkit/orca worktree — after `spawn-worktree`, before `ship` — and forks only rpi's per-phase implement loop; the back-half (`spawn-worktree`, `ship`, `review-cycle`) stays a handoff, not a fork.
- **demo `plans/`** — the output and execution target. `plan-author` reads `plans/refs/authoring.md` + `plans/AGENTS.md` as the authoritative *authoring* contract; `plan-implement` and the `plan-implementer` agent read `plans/IMPLEMENTATION.md` as the authoritative *working* contract (session entry, divergence, phase exit, retro).
