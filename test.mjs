// Offline tests for dshx-ai-approval (no network, no DSH host).
//   node test.mjs [path/to/index.js]
import assert from 'node:assert/strict'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

process.env.DSHX_AI_APPROVAL_NO_LOG = '1'
const target = process.argv[2] ? path.resolve(process.argv[2]) : new URL('./index.js', import.meta.url).pathname.replace(/^\/(\w:)/, '$1')
const { apply, isAiSession, judge, parseDecision, decideAutomatically, reviewers } = await import(pathToFileURL(target).href)

const EFFORTS = { reasoning: { efforts: [{ id: 'high' }, { id: 'low' }, { id: 'medium' }] } }
const session = { id: 'session-test' }
const req = { agent: { session }, toolName: 'pwsh', reason: 'escalate sandbox to danger-full-access: write one report' }

function context(response, options = {}) {
  let calls = 0
  return {
    get calls() { return calls },
    llm: {
      async resolveModelInfo() { if (options.invalid) throw Error('bad model'); return options.info ?? EFFORTS },
      async *stream(params) {
        calls++
        assert.equal(params.provider, 'test')
        assert.equal(params.model, 'reviewer')
        assert.ok(params.maxTokens >= 2048, 'reviewer must get room past its reasoning')
        assert.equal(params.messages[0].role, 'user')
        assert.equal(params.sessionId, undefined)
        if (options.info === undefined) assert.equal(params.reasoningEffort, 'low', 'lowest advertised effort')
        else if (!options.info?.reasoning) assert.equal('reasoningEffort' in params, false)
        if (options.reasoning) yield { type: 'block-start', index: 0, blockType: 'reasoning' }
        yield { type: 'block-start', index: options.reasoning ? 1 : 0, blockType: 'text' }
        yield { type: 'text-delta', index: options.reasoning ? 1 : 0, text: response }
        yield { type: 'finish', reason: { kind: options.finish || 'stop' } }
      },
    },
  }
}
const sel = { provider: 'test', model: 'reviewer' }
assert.equal(await judge(context('ALLOW'), req, { provider: '', model: '' }), undefined)
for (const [response, expected] of [['ALLOW', 'allowed-once'], ['DENY', 'rejected'], ['ALLOW because', undefined], ['allow', 'allowed-once']]) {
  assert.equal(await judge(context(response), req, sel), expected)
}
assert.equal(await judge(context('ALLOW', { invalid: true }), req, sel), undefined)
assert.equal(await judge(context('ALLOW', { reasoning: true }), req, sel), 'allowed-once')
assert.equal(await judge(context('ALLOW', { finish: 'length' }), req, sel), undefined)
// Models without reasoning get no reasoningEffort field (would be rejected).
assert.equal(await judge(context('ALLOW', { info: {} }), req, sel), 'allowed-once')
assert.equal(isAiSession({ permissionPresets: { current: () => 'ai-approval' } }, session), true)
assert.equal(isAiSession({ permissionPresets: { current: () => 'workspace-write' } }, session), false)
assert.equal(parseDecision(' "ALLOW". '), 'allowed-once')
assert.equal(parseDecision('**deny**'), 'rejected')
assert.equal(parseDecision('I would ALLOW this'), undefined)

let seenSystem = null
const promptCtx = { llm: { async resolveModelInfo() { return {} }, async *stream(params) {
  seenSystem = params.system
  yield { type: 'block-start', index: 0, blockType: 'text' }
  yield { type: 'text-delta', index: 0, text: 'ALLOW' }
  yield { type: 'finish', reason: { kind: 'stop' } }
} } }
await judge(promptCtx, req, { ...sel, systemPrompt: '  CUSTOM RULES  ' })
assert.equal(seenSystem, 'CUSTOM RULES')
await judge(promptCtx, req, sel)
assert.ok(seenSystem.includes('approver'))

// Hook routing through apply(ctx, config).
const aiSession = { id: 'session-ai' }
function hook(answers, config = sel) {
  let listener, streams = 0
  const queue = [...answers]
  const ctx = {
    permissionPresets: { current: (current) => current === aiSession ? 'ai-approval' : 'workspace-write' },
    get: () => undefined,
    llm: {
      async resolveModelInfo() { return {} },
      async *stream() {
        streams++
        const next = queue.shift()
        if (next instanceof Error) throw next
        if (next === '') { yield { type: 'finish', reason: { kind: 'error', failure: { code: 'EMPTY_RESPONSE', message: 'no content' } } }; return }
        yield { type: 'block-start', index: 0, blockType: 'text' }
        yield { type: 'text-delta', index: 0, text: next }
        yield { type: 'finish', reason: { kind: 'stop' } }
      },
    },
    on: (event, callback, options) => { assert.equal(event, 'approval/request'); assert.equal(options.prepend, true); listener = callback },
    effect: () => {},
    webServer: {},
  }
  apply(ctx, config)
  return { listener, get streams() { return streams } }
}
let humanCalls = 0
const human = () => { humanCalls++; return 'allowed-once' }
const aiReq = { agent: { session: aiSession }, toolName: 'pwsh', reason: 'install plugin' }

// AI ALLOW is final and never reaches a human.
let h = hook(['ALLOW']); assert.equal(await h.listener(aiReq, human), 'allowed-once')
h = hook(['hmm', 'ALLOW']); assert.equal(await h.listener(aiReq, human), 'allowed-once'); assert.equal(h.streams, 2)
h = hook([new Error('network'), 'ALLOW']); assert.equal(await h.listener(aiReq, human), 'allowed-once')
h = hook(['', 'ALLOW']); assert.equal(await h.listener(aiReq, human), 'allowed-once'); assert.equal(h.streams, 2)
assert.equal(humanCalls, 0)

// Backup reviewer.
const withBackup = { ...sel, fallbackProvider: 'test2', fallbackModel: 'backup' }
const cooldown = new Error('SERVER pool "x" exhausted: every member is cooling down')
// Primary fails twice -> backup answers.
h = hook([new Error('network'), new Error('network'), 'ALLOW'], withBackup); assert.equal(await h.listener(aiReq, human), 'allowed-once'); assert.equal(h.streams, 3)
// Cooldown skips the primary's second attempt and goes straight to the backup.
h = hook([cooldown, 'ALLOW'], withBackup); assert.equal(await h.listener(aiReq, human), 'allowed-once'); assert.equal(h.streams, 2)
// A conclusive DENY from the primary is not second-guessed by the backup.
h = hook(['DENY', 'ALLOW'], withBackup); assert.equal(await h.listener(aiReq, () => 'rejected'), 'rejected'); assert.equal(h.streams, 1)
// Backup identical to primary is ignored.
assert.equal(reviewers({ ...sel, fallbackProvider: 'test', fallbackModel: 'reviewer' }).length, 1)
assert.deepEqual(reviewers({ provider: '', model: '', fallbackProvider: 'b', fallbackModel: 'm' }).map((r) => r.role), ['fallback'])
// Both reviewers fail -> human.
h = hook([cooldown, cooldown], withBackup); assert.equal(await h.listener(aiReq, () => 'allowed-once'), 'allowed-once'); assert.equal(h.streams, 2)
assert.equal(humanCalls, 0)
// AI DENY, inconclusive, or unconfigured -> falls back to the human channel.
h = hook(['DENY']); assert.equal(await h.listener(aiReq, human), 'allowed-once'); assert.equal(humanCalls, 1)
h = hook(['maybe', 'unsure']); assert.equal(await h.listener(aiReq, human), 'allowed-once'); assert.equal(humanCalls, 2); assert.equal(h.streams, 2)
h = hook([], { provider: '', model: '' }); assert.equal(await h.listener(aiReq, human), 'allowed-once'); assert.equal(h.streams, 0); assert.equal(humanCalls, 3)
h = hook(['DENY']); assert.equal(await h.listener(aiReq, () => 'rejected'), 'rejected')
// Non-AI sessions go straight to the human channel.
h = hook(['ALLOW'])
assert.equal(await h.listener({ agent: { session: {} }, toolName: 'pwsh' }, () => { humanCalls++; return 'rejected' }), 'rejected')
assert.equal(humanCalls, 4); assert.equal(h.streams, 0)
void decideAutomatically

// Bundle patch: AI approval is the default preset for new sessions and the
// built-in presets survive the whole-config replacement.
import fs from 'node:fs'
const patch = fs.readFileSync(path.join(path.dirname(target), 'cordis.patch.yml'), 'utf8')
assert.match(patch, /^\s+defaultPreset:\s*ai-approval\s*$/m)
for (const preset of ['read-only', 'workspace-write', 'danger-full-access', 'ai-approval']) assert.match(patch, new RegExp('^\\s+' + preset + ':', 'm'))
console.log('AI approval tests passed')
