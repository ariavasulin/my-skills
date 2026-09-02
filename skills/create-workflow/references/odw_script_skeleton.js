// Generated from <.artifacts/TASK/NN-workflow-SLUG.md> for target: codex.
// Edit the approved document and regenerate; do not hand-patch this file.
// ODW injects every runtime primitive used below. Do not import runtime helpers.
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
// A direct agent() failure throws. parallel() and pipeline() convert a failed
// unit to a null slot, which this script must check after the fan-out returns.
// A *blocked* agent does not die — it "succeeds" by returning a handoff that
// describes what it couldn't do. So a stop-stage node must also be able to
// declare its own failure. Two forms are wired below:
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

// ---- Portable schema contract -------------------------------------------
// ODW validates a deliberately small JSON Schema grammar. Compilation must
// reject an unsupported keyword or malformed allowed value instead of emitting
// a schema that the runtime would silently interpret more weakly.
const SCHEMA_KEYS = new Set([
  'type',
  'enum',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'minItems',
])
const SCALAR_TYPES = new Set(['object', 'array', 'string', 'integer', 'number', 'boolean', 'null'])

const assertPortableSchema = (schema, path = 'schema') => {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    throw new Error(`${path}: schema must be an object`)
  }
  for (const keyword of Object.keys(schema)) {
    if (!SCHEMA_KEYS.has(keyword)) throw new Error(`${path}: unsupported schema keyword ${keyword}`)
  }
  if ('type' in schema && (typeof schema.type !== 'string' || !SCALAR_TYPES.has(schema.type))) {
    throw new Error(`${path}.type: expected one supported scalar type, not a union or unknown value`)
  }
  if ('enum' in schema && !Array.isArray(schema.enum)) {
    throw new Error(`${path}.enum: expected an array`)
  }
  if ('properties' in schema) {
    if (!schema.properties || typeof schema.properties !== 'object' || Array.isArray(schema.properties)) {
      throw new Error(`${path}.properties: expected an object`)
    }
    for (const [name, child] of Object.entries(schema.properties)) {
      assertPortableSchema(child, `${path}.properties.${name}`)
    }
  }
  if ('required' in schema && (
    !Array.isArray(schema.required) || schema.required.some(name => typeof name !== 'string')
  )) {
    throw new Error(`${path}.required: expected an array of strings`)
  }
  if ('additionalProperties' in schema && typeof schema.additionalProperties !== 'boolean') {
    throw new Error(`${path}.additionalProperties: expected a boolean`)
  }
  if ('items' in schema) assertPortableSchema(schema.items, `${path}.items`)
  if ('minItems' in schema && (
    !Number.isInteger(schema.minItems) || schema.minItems < 0
  )) {
    throw new Error(`${path}.minItems: expected a non-negative integer`)
  }
  return schema
}

// ---- Node lowering -------------------------------------------------------
// Copy one declaration per approved node. Preserve its backend-native model;
// never translate model names. The sibling .codex.odw.json pins high effort
// for each used adapter because ODW has no per-agent effort option.
const odwOptions = (node) => {
  if (node.backend !== 'claude' && node.backend !== 'codex') {
    throw new Error(`${node.label}: unsupported backend ${node.backend}`)
  }
  if (typeof node.model !== 'string' || !node.model) {
    throw new Error(`${node.label}: model is required`)
  }
  if (node.schema) assertPortableSchema(node.schema, `${node.label}.schema`)
  return {
    adapter: node.backend,
    label: node.label,
    phase: node.phase,
    model: node.model,
    ...(node.agentType ? { agentType: node.agentType } : {}),
    ...(node.schema ? { schema: node.schema } : {}),
  }
}

// Thin prompts use the syntax and fallback directory of the node's backend.
// Shared entries may come only from this repository's .agents/skills directory.
const skillPrompt = (node, promptArgs, handoff, failIfMissing) => {
  if (!node.skill) throw new Error(`${node.label}: skill is required for a skill-backed prompt`)
  const invocation = node.backend === 'claude'
    ? `/${node.skill} ${promptArgs}`
    : `$${node.skill} ${promptArgs}`
  const runtimeEntry = node.backend === 'claude'
    ? `~/.claude/skills/${node.skill}/SKILL.md`
    : `~/.codex/skills/${node.skill}/SKILL.md`
  return [
    invocation,
    `If the skill is unavailable, read ${runtimeEntry} or the matching`,
    `.agents/skills/${node.skill}/SKILL.md shared entry in this repo and follow it exactly.`,
    `Start from the repo root. Do not restate or reinterpret the skill's procedure.`,
    handoff ? `Return: ${handoff}` : '',
    failIfMissing ? failClosed(failIfMissing) : '',
  ].filter(Boolean).join('\n')
}

// Free-form node (only when the approved document's stanza justified it):
// const prompt = `...thin instruction that names paths and the return shape...`

// ---- Schemas (one per parsed handoff) ------------------------------------
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
          evidence: { type: 'string' },
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
    count: { type: 'integer' },
  },
}

const EXAMPLE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['ok', 'summary'],
  properties: { ok: { type: 'boolean' }, summary: { type: 'string' } },
}

// ---- Approved nodes ------------------------------------------------------
// Replace these examples one-for-one from the approved graph. `agentType` is
// optional persona/routing metadata; it never supplies tools or permissions.
const PRE_NODE = {
  backend: 'codex',
  model: 'gpt-5.6-sol',
  label: 'preflight',
  phase: 'Preflight',
  agentType: 'general-purpose',
  schema: PREFLIGHT_SCHEMA,
}
const RESEARCH_NODE = {
  backend: 'codex',
  model: 'gpt-5.6-sol',
  skill: 'create-research',
  label: 'research',
  phase: 'Stage 1',
  agentType: 'general-purpose',
  schema: PRODUCER_SCHEMA,
}
const IMPLEMENT_NODE = {
  backend: 'codex',
  model: 'gpt-5.6-sol',
  skill: 'implement-plan',
  label: 'implement',
  phase: 'Stage 2',
  agentType: 'general-purpose',
}
const VERIFY_NODE = {
  backend: 'claude',
  model: 'fable',
  skill: 'verify-deliverable',
  label: 'verify',
  phase: 'Stage 3',
  schema: EXAMPLE_SCHEMA,
}

// Validate all emitted schemas and node routing before the first agent spends.
const APPROVED_NODES = [PRE_NODE, RESEARCH_NODE, IMPLEMENT_NODE, VERIFY_NODE]
APPROVED_NODES.forEach(odwOptions)

// ---- Graph ---------------------------------------------------------------
phase('Preflight')
const pre = mustSucceed('preflight', await agent(
  [
    "Prove this run's live dependencies. For each, run the cheapest real call and record",
    'the exact command and its output as evidence — never infer liveness from config.',
    '  - <each API / DB / service the approved document lists>',
    'A credential that refreshes through an interactive browser login cannot be fixed here.',
    failClosed('a proven-live result for every dependency above'),
  ].join('\n'),
  odwOptions(PRE_NODE),
))
const dead = pre.checks.filter(check => !check.alive)
if (dead.length) throw new Error(`preflight: dead dependencies — ${dead.map(x => x.dependency).join(', ')}`)

phase('Stage 1')
const research = mustSucceed('research', await agent(
  skillPrompt(RESEARCH_NODE, '.artifacts/TASK', 'artifactPath and count', 'the research artifact'),
  odwOptions(RESEARCH_NODE),
))
if (!research.artifactPath || research.count === 0) {
  throw new Error(`research produced nothing usable (count=${research.count}) — later stages need the artifact`)
}

phase('Stage 2')
const implPrompt = (n) => [
  skillPrompt(IMPLEMENT_NODE, `${research.artifactPath} phase ${n}`, 'changed files', `the phase-${n} edits`),
  declareUntested,
].join('\n')
const impl = await parallel([
  () => agent(implPrompt(1), odwOptions({ ...IMPLEMENT_NODE, label: 'implement:1' })),
  () => agent(implPrompt(2), odwOptions({ ...IMPLEMENT_NODE, label: 'implement:2' })),
])
impl.forEach((result, index) => mustSucceed(`implement:${index + 1}`, result))

phase('Stage 3')
const verdict = await agent(
  skillPrompt(VERIFY_NODE, '.artifacts/TASK', 'structured verdict'),
  odwOptions(VERIFY_NODE),
)

// ---- Optional portable ODW primitives -----------------------------------
// Emit only the examples the approved graph declares, replacing every literal
// below with that document's IDs, paths, deterministic args, models, and phases.

// Deterministic args and a positive budget target can size a pipeline. ODW's
// budget.spent() is an estimated output count; never compile exact cross-runtime
// spent-token parity into control flow.
// const requestedItems = Array.isArray(args.items) ? args.items : []
// if (!Number.isFinite(budget.total) || budget.total <= 0) {
//   throw new Error('budget.total must be a positive number')
// }
// const itemLimit = Math.max(1, Math.floor(budget.total / 4000))
// const selectedItems = requestedItems.slice(0, itemLimit)
// const inspected = await pipeline(selectedItems, async (previous, item, index) => mustSucceed(
//   `inspect:${index + 1}`,
//   await agent(
//     skillPrompt(IMPLEMENT_NODE, String(item), 'plain-text finding', 'an item finding'),
//     odwOptions({ ...IMPLEMENT_NODE, label: `inspect:${index + 1}`, phase: 'Inspect' }),
//   ),
// ))
// Pipeline converts a thrown item failure to null, so stop-stage polarity needs
// this post-pipeline escalation rather than relying only on the callback throw:
// inspected.forEach((result, index) => mustSucceed(`inspect:${index + 1}`, result))

// One ODW workflow may invoke one approved child by repository/source-relative
// path. ODW resolves scriptPath from the run source directory; never emit only a
// sibling basename.
// const child = await workflow(
//   { scriptPath: '.artifacts/TASK/workflow-CHILD.codex.js' },
//   { artifactPath: research.artifactPath },
// )

// Terminal return = exactly what the human boundary in the document needs.
return { preflight: pre.checks, research, impl, verdict }
