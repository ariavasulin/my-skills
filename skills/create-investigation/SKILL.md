---
name: create-investigation
description: Define and reconcile a proof-led Demo investigation brief before research planning and workflow execution. Use for a new report-directed investigation; not account onboarding, a one-candidate deep dive, running the investigation, or composing its report.
disable-model-invocation: true
---

**First, ensure the artifact store symlink exists in this worktree** (idempotent — re-running is a no-op):

```bash
# Ensure the planning-harness artifact store is linked into this worktree
if [ ! -L .artifacts ]; then
  MAIN=$(git worktree list --porcelain | head -1 | sed 's/worktree //')
  REPO=$(basename "$MAIN")
  # Store lives under the Orca workspaces root (an "allowed root") so Orca's file
  # explorer can open it; one physical store shared by all worktrees of this repo.
  STORE="$HOME/orca/workspaces/$REPO/.artifacts-store"
  mkdir -p "$STORE/archive"
  ln -sfn "$STORE" .artifacts
fi
```

# Investigation Definition Phase

Create the ratified planning brief for a proof-led Demo investigation. This is the synchronous front end to a longer chain:

```text
create-investigation definition
  → create-research-questions
  → create-research
  → create-investigation reconciliation
  → create-workflow draft, approval, and launch
  → concluded and verified investigation PR + review record
  → later create-report or infographic session
```

This skill owns the investigation's intent until the live arc is scaffolded. It does not run formal research, create the live investigation folder, compose or launch the workflow, pull production data, write platform state, open the PR, or draft the later report.

## How the conversation works

**Exactly one consequential question per message.** Present the decision, 2–3 real alternatives when alternatives exist, their tradeoffs, and your recommendation; then stop. Do not batch a questionnaire or end with a vague request for feedback. Ask only what could change the brief or prevent an expensive wrong investigation.

**Rewrite the same brief after every answer.** Fold the decision into every affected section, removing superseded wording so the artifact always reads as one cohesive current-form brief rather than a transcript or changelog.

**Settle definition before execution.** The user first ratifies what the evidence is for, the working concepts, and the hypothesis frontier. Formal research then maps current reality objectively. After research, this skill resumes for a short synchronous reconciliation; only evidence-bearing changes reopen decisions. `create-workflow` remains a separate ratification gate before any investigation run begins.

**Use bounded context gathering, not premature research.** When one factual question blocks the next decision, use a small read-only fanout to answer it in the conversation. The move creates no durable artifact and does not substitute for `create-research-questions` plus `create-research`.

**Keep the inquiry abductive and falsifiable.** The intended deliverable gives evidence collection a direction, not a fixed answer. Preserve the user's hunches, generate credible missing or competing hypotheses, and name what could disprove each. Avoid both broad exploratory analysis with no claim in view and a fixed thesis seeking confirmation.

---

<step index="1" name="resolve-the-input-and-mode">

<instructions>
1. Confirm this is the Demo repository by locating and reading these governing sources fully:
   - `python/investigations/refs/investigation-loop.md`
   - `python/investigations/refs/workflow-composition.md`
   If they are absent, stop and explain that this skill is deliberately Demo-specific.
2. Resolve the task directory from an argument or the conversation. Use `ls -La .artifacts/TASKNAME`; `.artifacts` may be a symlink. If no directory exists, create one from a concise task slug.
3. Read every user-mentioned source fully, including tickets, account context, engagement context, exemplar deliverables, and supplied evidence. Within the task directory, read relevant planning and research artifacts fully; skip research-question documents except when the user explicitly asks to inspect them. Obey the repository's frozen-record boundaries.
4. Read `{SKILLBASE}/references/investigation_brief_template.md`.
5. Select one mode:
   - **Definition:** no investigation brief exists, or an existing brief is still `definition-draft`.
   - **Reconciliation:** the user supplies an existing `research-ready` investigation brief and the completed formal research artifact.
   - **Already workflow-ready:** do not reopen the interview unless the user supplies new evidence or asks for a change; hand off to `create-workflow`.

If more than one brief or research artifact could be current and the intended pair cannot be resolved from explicit paths or chronology, ask the user to choose before reading candidate artifacts.
</instructions>

</step>

<step index="2" name="start-or-resume-the-brief">

<instructions>
In Definition mode, write the next chronological artifact as `.artifacts/TASKNAME/NN-investigation-brief-DESCRIPTION.md`. Use the template's six sections and frontmatter status `definition-draft`. Create this artifact once; every later answer rewrites the same file.

Populate only what the inputs already establish. Cite source artifacts instead of duplicating long context. Leave genuinely unknown content visibly provisional, but do not fill the document with placeholder prose.

Open the conversation with the highest-level unresolved decision: the outcome and intended later deliverable. Quote the current draft of that section so the user reacts to the actual brief, then ask exactly one question.

In Reconciliation mode, re-read the brief and research artifact fully, change the brief status to `reconciliation-draft`, and continue at Step 4. Never create a second brief for reconciliation.
</instructions>

</step>

<step index="3" name="definition-conversation">

<instructions>
Settle the brief in this order, while skipping questions whose answers are already supplied and coherent:

1. **Outcome and intended deliverable.** Establish the audience, engagement stage, business decision, later artifact type, transferable traits from exemplars, one-line argument the investigation will test, and one line per proposed section or figure naming its job. The skeleton directs evidence collection; it is not report copy.
2. **Context and known evidence.** Record the business, account, platform, and engagement context that changes the inquiry; distinguish established facts with owning sources and freshness limits from unknowns the investigation must resolve.
3. **Working ontology.** Use only two plain categories:
   - **Given or ratified:** a definition supplied by the user or explicitly settled in this discussion.
   - **Discover and ratify:** an account-specific unit, state, event, actor, or mechanism that research or investigation evidence must establish before use.
   Do not require a complete ontology before research, and do not leave a load-bearing term undefined without routing it to discovery.
4. **Hypothesis frontier.** Preserve user hunches and add missing, competing, or stronger hypotheses supported by the context. Rank the frontier. Every entry needs a stable kebab-case `id`, proposed claim, dimension, plausibility and mechanism, likely evidence location, falsifying bar or rival explanation, and intended later-report role. A hunch remains provisional even when it matches the intended narrative.
5. **Scope and authority.** Record the exact accounts, platforms, windows, inclusions, exclusions, available grants, permitted writes, spend or paid-call doors, and human-only decisions. Brief approval never authorizes live pulls, paid calls, production writes, or workflow launch.
6. **Completion and handoff.** State what research must return, what the workflow must prove, and what makes the investigation complete. The target is a concluded and verified corpus, an open investigation PR, and its defined review record. Review remediation is a follow-up human decision. Report or infographic composition is a later session.

After each answer, rewrite the affected sections before asking the next question. If a decision changes the outcome, scope, ontology, or frontier, reconcile all dependent sections in the same pass.
</instructions>

<guidance>
## Frontier quality

The frontier should be broad enough to resist the user's first story but narrow enough that each entry nominates a discriminating cut. Rank by the decision-weight, discrimination, and cost intuition in `investigation-loop.md`; do not turn it into a numeric formula.

Formal research is not the investigation's proof phase. At this stage, `where_to_look` may name likely code, account, warehouse, platform, document, or external-knowledge sources. The later workflow determines and executes the minimal proof-bearing cuts.

## Live-charter seam

The planning brief is not a second canonical investigation charter. It must tell the later workflow to create the live arc, project the approved brief once into the new root `context.md`, and write the canonical `## Investigation charter` with:

- `Status: ready`
- a bounded `Frame`
- a ranked frontier whose entries carry `id`, `hypothesis`, `dimension`, `where_to_look`, and `falsifying_bar`

After scaffold time, `context.md` supersedes the planning brief as current investigation state.
</guidance>

</step>

<step index="4" name="reconcile-formal-research">

<instructions>
Treat the research artifact as the objective account of current reality and the investigation brief as the owner of user intent. Compare them for:

- context or feasibility the research confirms;
- facts, definitions, assumptions, or hunches it contradicts;
- newly visible mechanisms, rivals, evidence locations, constraints, or unknowns;
- changes to scope, authority, deliverable direction, or the completion contract.

Research may sharpen, weaken, replace, or remove a hypothesis; it does not silently promote a hunch into a finding or decide a user-owned judgment. Ask exactly one question for each evidence-bearing decision the research reopens, rewriting the same brief after every answer. When research confirms the brief, update its sources and proceed directly to whole-document review rather than repeating the definition interview.

The reconciled frontier must still satisfy the live charter fields and stable-id rules. Record a ruled-out premise only when its absence helps the workflow avoid repeating a dead path; otherwise remove superseded material rather than keeping a change log.
</instructions>

</step>

<step index="5" name="whole-document-gate-and-handoff">

<instructions>
Before either handoff, re-read the entire brief for cohesion, contradictions, stale alternatives, and unsupported certainty. Then ask the user exactly one whole-document approval question.

For **research-ready** approval, require:

- a clear intended deliverable and decision-bearing skeleton;
- sourced context with knowns separated from unknowns;
- given-or-ratified and discover-and-ratify definitions;
- a ranked, falsifiable frontier with complete entries;
- exact scope, authority, and human gates;
- a completion contract that ends at the reviewed investigation PR rather than report composition.

On approval, set frontmatter status to `research-ready`, read `{SKILLBASE}/references/investigation_research_ready_final_answer.md`, and follow it exactly. V1 uses explicit handoffs; do not auto-launch the research skills.

For **workflow-ready** approval, also require that formal research has been reconciled and the brief tells workflow authoring to scaffold the live arc and project the canonical ready charter. On approval, set frontmatter status to `workflow-ready`, read `{SKILLBASE}/references/investigation_workflow_ready_final_answer.md`, and follow it exactly. Do not create or launch the workflow from this skill.
</instructions>

</step>

## Markdown formatting

When writing markdown that contains a fenced example of other markdown, use four backticks for the outer fence. Escape render-significant prose characters according to the repository guidance.
