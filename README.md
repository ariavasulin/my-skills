# my-skills

Personal, global Claude Code skills — a **planning front-end** for the `demo` codebase, forked from the rpi (`riptide-rpi`) pipeline and adapted so its output is native to the team's **peprkit + demo** harness.

## Why this exists

demo has a strong durable plan *contract* (`plans/`) and a strong automated *back-half* (peprkit `ship` / `review-cycle`), but no driven front-end that walks you from a vague task through research and design to a plan. These four skills fill that gap. They feel like rpi (which I like), but the final artifact is a native demo `plans/` contract, so there's zero friction at the boundary with the seniors' workflow.

Design principle: **minimal diff from the rpi originals — only the parts that would clash with peprkit/demo are changed.**

## The flow

```
/plan-research-questions  →  /plan-research  →  /plan-design  →  /plan-author
   (blind questions)          (blind answers)     (OPEN-question     (native demo plans/
                                                   design gate)        contract)
                                                                          │
                                          handoff ─────────────────────────┤
                                                          /peprkit:spawn-worktree
                                                          /peprkit:ship  +  /peprkit:review-cycle
```

| Skill | Forked from | What changed |
|---|---|---|
| `plan-research-questions` | rpi `create-research-questions` | rename + next-step pointer → `/plan-research` |
| `plan-research` | rpi `create-research` | rename + pointer → `/plan-design`; self-contained, keeps the blind-research firewall, does not touch peprkit `research-codebase` |
| `plan-design` | rpi `create-design-discussion` | rename + resolved-pointer → `/plan-author`; keeps OPEN-question human gate |
| `plan-author` | rpi `create-plan` | writes a demo `plans/active/` AC-contract (AC IDs + `Steps`/`Verify`/`Exit`) instead of a `.humanlayer/tasks` checkbox plan; hands off to `/peprkit:spawn-worktree` + `/peprkit:ship` instead of `/rpi:setup-worktree` |

Intermediate docs (questions / research / design) still land in `.humanlayer/tasks/<task>/` (unchanged — the cloud-permalink hooks still fire). Only the final plan diverges into git-tracked `plans/active/`.

## Install (symlink into the global skills dir)

Real files live here; each skill directory is symlinked into `~/.claude/skills/` (the same pattern as the `orca` skill):

```bash
for s in plan-research-questions plan-research plan-design plan-author; do
  ln -sfn "$PWD/skills/$s" ~/.claude/skills/"$s"
done
```

Claude Code follows the directory symlink, so `{SKILLBASE}/references/...` resolves correctly.

## Relationship to the upstream harnesses

- **rpi** — the fork source. These supersede the rpi `create-*` commands for demo work.
- **peprkit** — untouched. `plan-research` coexists with peprkit `research-codebase` (this one is blind/in-pipeline; that one is general/ad-hoc). The back-half (`spawn-worktree`, `ship`, `review-cycle`) is a handoff, not a fork.
- **demo `plans/`** — the output target. `plan-author` reads `plans/refs/authoring.md` + `plans/AGENTS.md` as the authoritative contract when present.
