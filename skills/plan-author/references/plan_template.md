---
status: active
created: [YYYY-MM-DD]
updated: [YYYY-MM-DD]
---

# [Plan title]

**Preamble.** [Declare the shape mix: design doc / RFC, tech spec, implementation plan — and which are in play here. If this is a lightweight plan, say so and justify it: no new contract surface, no cross-artifact dependency, no meaningful implementation ambiguity. State PRD coupling if any.]

## Why

[The structural reason this work must happen. Name the "do nothing" option explicitly and why it loses.]

## Goals

- [Falsifiable goal — what is true when this lands.]

## Non-goals

- [Scope deliberately chosen against — not negated obvious truths. Each noted as "chosen against, not omitted."]

## System sketch
<!-- Include for tech-spec / design-doc shapes; omit for a small lightweight plan. -->

```
[ASCII or mermaid diagram naming components, call flow, and where state lives.]
```

## Detailed Design / Contract surface
<!-- Tech-spec shape: names, schemas, error classes, retry policies, log shapes that are hard to reverse, cross an ownership boundary, encode a non-obvious invariant, or where reasonable engineers would diverge. Internal helper names and file layout are out of scope. -->

### Acceptance Criteria

- **AC-1:** When [trigger], the system shall [response]. _Example:_ [input → output].
- **AC-2:** ...

<!-- Frankenstein guard: do NOT let an AC or deterministic gate key on an LLM/learned grade, classification, judgment, or fitted magnitude. Gate on structurally readable properties, or route the value to prose/ranking/human review. -->

## Phase 1 — [name]

One paragraph: what this phase establishes, why it is next, what it defers.

### Steps
1. [concrete deliverable]

### Verify
- [ ] [AC-1] [scenario or command that proves it]
- [ ] [existing suite still green for touched modules — e.g. `poe -C python test`]

### Exit criteria
[Observable state proving this phase is complete.]

## Phase 2 — [name]

...

<!-- Testing lives in each phase's Verify block, tagged to AC IDs — never a trailing "Testing" section deferred to later. -->
