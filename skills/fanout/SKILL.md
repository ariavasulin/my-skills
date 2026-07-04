---
name: fanout
description: "Lightweight in-session context gathering: before acting on a task, fan out parallel read-only research subagents (codebase-locator/-analyzer/-pattern-finder, web-search-researcher) and synthesize findings into the conversation. No documents, no artifacts, no phases — a quick research burst. Invoke with /fanout <topic or question>, or bare /fanout to research whatever the current conversation is working on."
---

# Fanout — lightweight context gathering

Gather context by fanning out parallel research subagents, then synthesize what they found into the session. This is the in-session, throwaway sibling of `/plan-research`: same fan-out instinct, none of the ceremony. No artifact store, no templates, no output files — the deliverable is a short synthesis in the conversation.

## Scope

- **Read-only research.** Subagents document what exists — where things live, how they work, what patterns exist. No edits, no fixes, no recommendations from subagents.
- **Descriptive prompts, not normative.** Prompt subagents about how things work today ("how does X flow through Y"), not about what we're planning to build ("how would we add Z"). Keeps findings objective and reusable.

## Steps

1. **Determine the research target.**
   - If arguments were given, that's the target.
   - If invoked bare, the target is whatever the current conversation is about to act on — infer it from context. If there's genuinely nothing to infer, ask.

2. **Decompose into 2-5 research prompts.** Break the target into areas that touch *different* parts of the codebase (or the web). Group related questions into one prompt rather than one agent per question. Match agent to job:
   - **codebase-locator** — find WHERE relevant files/components live
   - **codebase-analyzer** — understand HOW specific code works
   - **codebase-pattern-finder** — find existing examples/conventions to model after
   - **web-search-researcher** — library/SDK/external docs, only if the target genuinely needs it; ask it to return links

   Seed prompts with starting points when you know them (`.trace-context.md`, module `AGENTS.md`, directories already mentioned in the conversation).

3. **Fan out in parallel.** Launch all subagents in a single message. Wait for all of them.

4. **Synthesize in-session.** Write a brief synthesis directly in your response — no file:
   - What the relevant landscape looks like, concept-first, with `file:line` citations woven in
   - Anything that changes the plan of attack (constraints, existing utilities, conventions, surprises)
   - Open unknowns worth flagging, if any

   Keep it tight — this is working context, not a research doc. If the findings warrant a durable document, say so and point at `/plan-research` or `/peprkit:research-codebase` instead of writing one here.

5. **Proceed.** If the fanout was a preamble to a task already in flight, continue with that task, now informed. If it was a standalone question, the synthesis is the answer — stop there.
