---
name: plan-author
description: "Personal planning front-end (step 4 of 4) for the demo codebase: author a native demo plans/ contract (AC IDs + Steps/Verify/Exit) from the research + design discussion, written into plans/active/, then hand off to /peprkit:spawn-worktree and /peprkit:ship. Forked from rpi create-plan, adapted for the demo+peprkit workflow."
---

# Plan Author (demo `plans/` contract)

You are in the final Plan Writing phase. Author a complete, mechanism-precise implementation plan from the research and design-discussion documents, written as a **native demo `plans/` contract** (per `plans/AGENTS.md` and `plans/refs/authoring.md`). This pipeline has no separate structure-outline phase — you go straight from the resolved design discussion to the plan.

## Steps

1. **Read all input files FULLY**:
   - Use Read tool WITHOUT limit/offset to read all provided file paths
   - `ls -La .humanlayer/tasks/TASKNAME` to find all related documents in the task directory. Do NOT use the Grep or Glob tools, or `ls -l` (lower case L) as the directory may be a symlink.
   - Read everything in the task directory to build full context, excluding research questions documents
   - **DO NOT read research questions documents** - research questions are inputs to the research phase only. Use the completed research document instead.

2. **Read relevant code files**:
   - Read any source files mentioned in the research, design, or structure documents
   - Build context for writing specific code examples

3. **Read the plan contract**:
   - If the repo has `plans/refs/authoring.md` and `plans/AGENTS.md`, read them FULLY — they are the authoritative demo plan contract (plan shapes, AC IDs, the canonical phase shape, failure guards, proportionality). Follow them over this skill's template if they differ.
   - Read this skill's contract template as the fallback shape:

`Read({SKILLBASE}/references/plan_template.md)`

4. **Write the plan into the demo `plans/` corpus** (git-tracked, NOT `.humanlayer/tasks/`):
   - Determine the module the work belongs to (e.g. `allocator`, `budget-pacer`, `anomalies`). Write to `plans/active/<module>/<slug>.md` for module-scoped work, or `plans/active/<initiative>.md` / `plans/active/<initiative>/` for cross-cutting work. Investigation-coupled plans live under `python/investigations/.../` per `plans/AGENTS.md`.
   - Add the frontmatter the contract expects: `status: active`, `created:`, `updated:`.
   - In the preamble, declare the plan's shape mix (design doc / tech spec / implementation plan) and, if lightweight, justify it per the proportionality rule.
   - Derive each phase from the design discussion + research; give every contract-level requirement an AC ID (`AC-1`, ...) with an input→output example, and tag each per-phase `Verify` item back to those AC IDs.
   - Include specific code examples; gate phases on observable `Exit criteria`, not build effort.

## Plan Writing Guidelines

- Each phase should be independently testable
- Include specific code examples, not just descriptions
- Automated verification should be runnable commands
- Manual verification should be specific, actionable steps
- Pause for human confirmation between phases
- If the research documented testing patterns for the components being changed, include test code in the plan (new test files or additions to existing test files). Follow the existing test patterns found in the research.

## Document Precedence

When documents conflict, the most recent document wins:
**plan > design discussion > research > ticket**

The plan is the final authority. Follow the design decisions over the original ticket when they differ. (This pipeline has no structure-outline phase.)

## Output

1. **Read the final output template**:

`Read({SKILLBASE}/references/plan_final_answer.md)`

2. Respond following the template exactly. Do not include a summary or other information.

<guidance>
## Cloud Permalinks

When you write or edit documents in .humanlayer/tasks/, a cloud permalink is automatically provided in the hook response.
- The permalink appears as `additionalContext` after Write/Edit/MultiEdit/Read operations
- Use this permalink in your final output for easy navigation
- Example format: `http(s)://{DOMAIN}/artifacts/{artifactId}`

## Markdown Formatting

When writing markdown files that contain code blocks showing other markdown (like README examples or SKILL.md templates), use 4 backticks (````) for the outer fence so inner 3-backtick code blocks don't prematurely close it:

````markdown
# Example README
## Installation
```bash
npm install example
```
````

## Validation Design

Not every phase requires manual validation, don't put steps for manual validation just to have them. 
</guidance>
