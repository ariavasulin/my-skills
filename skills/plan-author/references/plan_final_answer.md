## Next Steps

The plan has been written into the demo `plans/active/` corpus as a native plan contract.

Review it, then hand off to the peprkit + orca delivery flow — this personal pipeline stops at the plan and does **not** fork the back-half:

1. Spin up an isolated worktree:
   ```text
   /peprkit:spawn-worktree --name <name>
   ```
2. Implement the plan phase by phase, ticking each phase's `Verify` items as you observe them.
3. Ship through review and merge:
   ```text
   /peprkit:ship --pr
   ```
   then `/peprkit:review-cycle <PR#>` to drive the bot-review loop to approval.

The plan is git-tracked in `plans/active/`, so it travels with the branch and `/peprkit:ship`'s plan-drift sync will keep its AC text aligned with the implementation.
