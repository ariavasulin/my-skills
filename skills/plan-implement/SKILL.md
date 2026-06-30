---
name: plan-implement
description: "Personal implementation front-end for the demo codebase: orchestrate phased implementation of a native demo plans/active/ contract through the plan-implementer subagent, deferring to plans/IMPLEMENTATION.md as the working contract, then hand off to /peprkit:ship and /peprkit:review-cycle. Forked from rpi implement-plan, adapted for the demo+peprkit workflow. Use when asked to implement a plan in plans/active/."
---

# Plan Implement (demo `plans/` contract)

You orchestrate the phased implementation of a native demo plan from `plans/active/`, working one phase at a time through the `plan-implementer` subagent. Your role is orchestration, verification, and divergence control — the subagent does the per-phase code work.

The authoritative working contract is **`plans/IMPLEMENTATION.md`** (demo's native phased-implementation playbook). Read it before you start and follow it over this skill where they differ. This skill only carries the rpi orchestration loop and the peprkit handoff; `IMPLEMENTATION.md` owns session entry, scope discipline, delegation, divergence classification, phase exit, and the completion retro — do not restate it here, defer to it.

## Workflow

**First, ensure the artifact store symlink exists in this worktree** so any intermediate docs the plan references resolve (idempotent — re-running is a no-op):

```bash
# Ensure the planning-harness artifact store is linked into this worktree
if [ ! -L .artifacts ]; then
  MAIN=$(git worktree list --porcelain | head -1 | sed 's/worktree //')
  REPO=$(basename "$MAIN")
  mkdir -p "$HOME/artifacts/$REPO/archive"
  ln -sfn "$HOME/artifacts/$REPO" .artifacts
fi
```

### 0. Locate the plan
- The plan is a git-tracked file at `plans/active/<module>/<slug>.md` (or `plans/active/<initiative>/...`, or under `python/investigations/.../` for investigation-coupled plans). If given a path, use it; if given a slug or module, `ls plans/active/` to find it. Unlike rpi, `plans/` is a normal tracked directory — no symlink caveats, use ordinary `ls`/Glob.
- Read the plan FULLY (no limit/offset). Read `plans/IMPLEMENTATION.md` now; read `plans/AGENTS.md` too if the plan's shape (AC IDs, `Verify` blocks, shape mix) is unfamiliar.
- Identify the current phase: a phase whose `Verify`/`Exit` boxes are ticked is done; resume from the first phase with unticked `Verify` items (IMPLEMENTATION.md § Session entry).

### 1. Launch the implementer subagent
Use the Task tool with `subagent_type=plan-implementer` to implement the current phase. Brief it with the phase's AC statements and `Verify` items — a subagent editing code without the AC in front of it is how drift gets in (IMPLEMENTATION.md § Delegation). Keep the prompt short; the agent reads the plan itself.

Example:
```
Implement Phase [N] of plans/active/<module>/<slug>.md.
Focus only on Phase [N]; its ACs are [AC-x, AC-y]. Run each Verify item and stop after automated verification.
```

### 2. Review output
Read the subagent's report: what landed, any divergence it surfaced, which manual-verification steps it requests. It reports findings and open questions — you resolve them; contract decisions don't get decided off-thread.

### 3. Perform phase-exit verification
Independently run the phase's `Verify` items plus the existing suite for touched modules (`poe -C python test`, `npm --prefix app run lint`, etc.), per IMPLEMENTATION.md § Phase exit. Tick `Verify`/`Exit` boxes on observed evidence, not the subagent's assertion (guard: *Verify-as-formality*).

### 4. Classify any divergence
On a mismatch, classify per IMPLEMENTATION.md § Divergence and re-plan (implementation-level / contract-level / stale AC prose / re-plan / re-plan upward). Contract-level deviations update the plan in the same PR with rationale; a re-plan stops and escalates to the human. Keep this on the main thread — it is the work of holding the contract.

### 5. Report to the human and checkpoint
Summarize the phase: completed work, automated-verification results, and the manual checks the human still needs to perform. Then checkpoint per the root git workflow — `git add <files>` then `git commit --no-verify -m "checkpoint: <message>"`. The plan lives in `plans/active/` and is tracked: commit it alongside the code (refreshed `updated:` date, ticked boxes, logged deviations). Any intermediate docs in `.artifacts/` are gitignored via the global net, so there is nothing to exclude.

### 6. Wait for confirmation, then next phase
Unless expressly told to run phases consecutively, do not proceed to the next phase or finalize until the human has reviewed and approved this one. When cleared, repeat from step 1 for the next phase.

## After the final phase

When all phases are verified and marked, run the **completion retro** and the **lifecycle transition** per IMPLEMENTATION.md § Phase exit / Completion retro (set `status: done`, archive or delete in the merging PR; propagate any recurring learning). Then read the final output template:

`Read({SKILLBASE}/references/implement_final_answer.md)`

Respond following the template exactly. Do not include a summary or other information beyond it.

<guidance>
## Markdown Formatting

When writing markdown that contains code blocks showing other markdown, use 4 backticks (````) for the outer fence so inner 3-backtick blocks don't prematurely close it.
</guidance>
