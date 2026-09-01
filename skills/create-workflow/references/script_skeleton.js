// Generated from <.artifacts/TASK/NN-workflow-SLUG.md> — edit the doc, regenerate; don't hand-patch.
export const meta = {
  name: 'SLUG',
  description: 'ONE LINE FROM THE DOC GOAL',
  phases: [
    { title: 'Preflight', detail: 'prove the run\'s live dependencies' },
    { title: 'Stage 1', detail: '...' },
    { title: 'Stage 2', detail: '...' },
    { title: 'Stage 3', detail: '...' },
  ],
}

// ---- Failure contract ----------------------------------------------------
// agent() returns null only when the subagent actually dies. A *blocked* agent
// does not die — it "succeeds" by returning a handoff that describes what it
// couldn't do, and every downstream node then runs against missing data. So a
// stop-stage node must be able to declare its own failure, and this script must
// check it. Two forms, wired below:
//   schema nodes     → `ok: false` plus the cause in `blocked`
//   plain-text nodes → final message is the single line `WORKFLOW-NODE-FAILED: <reason>`
const FAILED = 'WORKFLOW-NODE-FAILED'

// Appended to every stop-stage node's prompt. Without it the node has no way to
// fail, and "I couldn't reach BigQuery" arrives as a perfectly valid result.
const failClosed = (coreOutput) => [
  `If you cannot produce ${coreOutput}, do not describe the problem and return normally.`,
  `Fail instead: with a structured-output schema, return ok:false with the cause in blocked;`,
  `otherwise make your final message the single line ${FAILED}: <cause>.`,
  `A handoff that explains why the work could not be done is a failure, not a result.`,
].join('\n')

// Appended to any node that may author code against a service it might not reach.
const declareUntested = [
  'If you write code you could not execute against the real service, say so in your handoff as',
  '"written-not-run against <service>: <what a smoke test still owes>". Never report it verified.',
].join('\n')

const failure = (label, result) => {
  if (result === null) return `${label}: agent did not return`
  if (typeof result === 'string') {
    const line = result.split('\n').find(l => l.trim().startsWith(FAILED))
    return line ? `${label}: ${line.trim().slice(FAILED.length + 1).trim()}` : null
  }
  if (result && result.ok === false) return `${label}: ${result.blocked || 'node returned ok:false'}`
  return null
}

// Stop-stage polarity. Drop-item polarity filters on failure() instead — see Stage 2.
const mustSucceed = (label, result) => {
  const why = failure(label, result)
  if (why) throw new Error(why)
  return result
}

// ---- Node prompt builder -------------------------------------------------
// Every node invokes its skill the same way. The first line is the slash
// command; the fallback covers runtimes where the subagent has no Skill tool.
// `failIfMissing` names the node's core output and is set for every stop-stage node.
const skillPrompt = (skill, args, handoff, failIfMissing) => [
  `/${skill} ${args}`,
  `If the Skill tool is unavailable, Read ~/.claude/skills/${skill}/SKILL.md (or the matching`,
  `.claude/skills / .agents/skills entry in this repo) and follow it exactly with the arguments above.`,
  `Start from the repo root. Do not restate or reinterpret the skill's procedure.`,
  handoff ? `Return: ${handoff}` : '',
  failIfMissing ? failClosed(failIfMissing) : '',
].filter(Boolean).join('\n')

// Free-form node (only when the doc's stanza justified it):
// const prompt = `...thin instruction that names paths and the return shape...`

// ---- Schemas (one per node whose handoff a later node or this script parses)
// A stop-stage node's schema carries `ok` + `blocked` so it can fail; a producer
// whose absence should gate a later stage carries the field that gate reads.
const PREFLIGHT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'blocked', 'checks'],
  properties: {
    ok: { type: 'boolean' },
    blocked: { type: 'string' },
    checks: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['dependency', 'alive', 'evidence'],
        properties: {
          dependency: { type: 'string' },
          alive: { type: 'boolean' },
          evidence: { type: 'string' },   // the command run and what it returned
        },
      },
    },
  },
}

const PRODUCER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'blocked', 'artifactPath', 'count'],
  properties: {
    ok: { type: 'boolean' },
    blocked: { type: 'string' },
    artifactPath: { type: 'string' },
    count: { type: 'integer' },          // what the Stage 2 gate reads
  },
}

const EXAMPLE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'summary'],
  properties: { ok: { type: 'boolean' }, summary: { type: 'string' } },
}

// ---- Nodes ----------------------------------------------------------------
// Per-node options come straight from the doc stanza:
//   model: 'fable' | 'opus'        effort: 'low' | 'medium' | 'high'
//   agentType: 'codebase-analyzer' | 'general-purpose' | ...
//   phase: the stage title         schema: when the handoff is parsed

// One cheap agent proves the doc's Live dependencies before anything fans out.
// Everything after this line assumes they are alive, so this is the only place
// a dead credential costs one node instead of nine.
phase('Preflight')
const pre = mustSucceed('preflight', await agent(
  [
    "Prove this run's live dependencies. For each, run the cheapest real call and record",
    'the exact command and its output as evidence — never infer liveness from config.',
    '  - <e.g. BigQuery: `bq query --use_legacy_sql=false "SELECT 1"`>',
    '  - <each other API / DB / service the doc lists>',
    'A credential that refreshes through an interactive browser login cannot be fixed from',
    'here — no subagent can complete that flow. Report it dead; do not attempt a repair.',
    failClosed('a proven-live result for every dependency above'),
  ].join('\n'),
  { label: 'preflight', phase: 'Preflight', model: 'fable', effort: 'low', agentType: 'general-purpose', schema: PREFLIGHT_SCHEMA },
))
const dead = pre.checks.filter(c => !c.alive)
if (dead.length) throw new Error(`preflight: dead dependencies — ${dead.map(c => c.dependency).join(', ')}`)

phase('Stage 1')
const r = mustSucceed('research', await agent(
  skillPrompt('create-research', '.artifacts/TASK', 'artifactPath and count', 'the research artifact'),
  { label: 'research', phase: 'Stage 1', model: 'opus', effort: 'high', agentType: 'general-purpose', schema: PRODUCER_SCHEMA },
))

// Gate on the edge right after the producer, not at the end of the run: Stages
// 2 and 3 are meaningless without this artifact, so the run stops here having
// spent two agents rather than all of them.
if (!r.artifactPath || r.count === 0) {
  throw new Error(`research produced nothing usable (count=${r.count}) — stages 2-3 would run on empty input`)
}

// Parallel group — only because the doc's graph says these are independent.
// These nodes author code, so their prompts carry declareUntested: anything they
// wrote but couldn't execute comes back labelled, not claimed as verified.
phase('Stage 2')
const implPrompt = (n) => [
  skillPrompt('implement-plan', `${r.artifactPath} phase ${n}`, 'changed files', `the phase-${n} edits`),
  declareUntested,
].join('\n')
const impl = await parallel([
  () => agent(implPrompt(1), { label: 'impl:1', phase: 'Stage 2', model: 'fable', effort: 'high', agentType: 'general-purpose' }),
  () => agent(implPrompt(2), { label: 'impl:2', phase: 'Stage 2', model: 'fable', effort: 'high', agentType: 'general-purpose' }),
])
// Failure polarity from the stanza. parallel() resolves a failed thunk to null,
// but a blocked-and-chatty agent resolves to a string — check both:
impl.forEach((x, i) => mustSucceed(`impl:${i + 1}`, x))                      // "stop stage"
// const done = impl.filter((x, i) => !failure(`impl:${i + 1}`, x))          // "drop item"

phase('Stage 3')
const verdict = await agent(
  skillPrompt('verify-deliverable', '.artifacts/TASK', 'structured verdict'),
  { label: 'verify', phase: 'Stage 3', model: 'opus', effort: 'high', agentType: 'general-purpose', schema: EXAMPLE_SCHEMA },
)

// Terminal return = exactly what the human boundary in the doc needs to decide.
return { preflight: pre.checks, research: r, impl, verdict }
