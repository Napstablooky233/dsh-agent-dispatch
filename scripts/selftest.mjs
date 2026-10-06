/**
 * dsh-agent-dispatch unit self-test (host half).
 * No test framework: writes its own assert, outputs TAP-like ok/not ok, with a summary at the end.
 * Run: node D:\dsh-agent-dispatch\scripts\selftest.mjs
 */

import { __test } from '../index.js'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const { renderPolicy, buildRoster, sanitizeConfig, splitKey, normalizeHelperKey, providerList, DEFAULT_CONFIG, CONFIG_VERSION, CHANNELS, SEED_ROWS } = __test

let pass = 0
let fail = 0
const results = []

function assert(name, condition, detail = '') {
  if (condition) {
    pass++
    results.push(`ok ${pass} - ${name}`)
  } else {
    fail++
    results.push(`not ok ${pass + fail} - ${name}${detail ? `  # ${detail}` : ''}`)
  }
}

function eq(name, actual, expected, detail = '') {
  const same = JSON.stringify(actual) === JSON.stringify(expected)
  if (same) {
    pass++
    results.push(`ok ${pass} - ${name}`)
  } else {
    fail++
    results.push(`not ok ${pass + fail} - ${name}  # got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`)
  }
}

// ===== splitKey / normalizeHelperKey =====
{
  const { provider, model } = splitKey('our-free-model:nemotron-3-ultra-free')
  eq('splitKey full key', { provider, model }, { provider: 'our-free-model', model: 'nemotron-3-ultra-free' })
}
{
  const { provider, model } = splitKey('bare-model')
  eq('splitKey bare model (v1 compat)', { provider, model }, { provider: 'our-free-model', model: 'bare-model' })
}
{
  const { provider, model } = splitKey('provider:model:with:colons')
  eq('splitKey model with colon', { provider, model }, { provider: 'provider', model: 'model:with:colons' })
}
{
  const { provider, model } = splitKey('')
  eq('splitKey empty', { provider, model }, { provider: 'our-free-model', model: '' })
}
{
  const { provider, model } = splitKey('provider:')
  eq('splitKey empty model', { provider, model }, { provider: 'provider', model: '' })
}

// normalizeHelperKey
{
  const k = normalizeHelperKey('our-free-model:model', 'our-free-model', true)
  eq('normalizeHelperKey already valid', k, 'our-free-model:model')
}
{
  const k = normalizeHelperKey('bare-model', 'our-free-model', true)
  eq('normalizeHelperKey migrate bare', k, 'our-free-model:bare-model')
}
{
  const k = normalizeHelperKey('bad key', 'our-free-model', true)
  eq('normalizeHelperKey invalid drops', k, '')
}
{
  const k = normalizeHelperKey('provider:model:extra', 'our-free-model', true)
  eq('normalizeHelperKey too many colons invalid', k, '')
}
{
  const k = normalizeHelperKey('model-with:colon', 'our-free-model', false)
  eq('normalizeHelperKey keeps valid provider:model untouched when not migrating', k, 'model-with:colon')
}
{
  const k = normalizeHelperKey('bare-model', 'our-free-model', false)
  eq('normalizeHelperKey drops bare model when not migrating', k, '')
}

// ===== sanitizeConfig =====
{
  const cfg = sanitizeConfig({ unknownField: 123 }, DEFAULT_CONFIG)
  assert('sanitizeConfig drops unknown top-level field', !('unknownField' in cfg))
}
{
  const cfg = sanitizeConfig({ maxHelpers: 0 }, DEFAULT_CONFIG)
  eq('sanitizeConfig maxHelpers<1 clamps to fallback', cfg.maxHelpers, DEFAULT_CONFIG.maxHelpers)
}
{
  const cfg = sanitizeConfig({ maxHelpers: 9 }, DEFAULT_CONFIG)
  eq('sanitizeConfig maxHelpers>8 clamps to 8', cfg.maxHelpers, 8)
}
{
  const cfg = sanitizeConfig({ maxHelpers: 4 }, DEFAULT_CONFIG)
  eq('sanitizeConfig maxHelpers valid', cfg.maxHelpers, 4)
}
{
  const cfg = sanitizeConfig({ minSteps: 0 }, DEFAULT_CONFIG)
  eq('sanitizeConfig minSteps<1 clamps', cfg.minSteps, DEFAULT_CONFIG.minSteps)
}
{
  const cfg = sanitizeConfig({ minSteps: 25 }, DEFAULT_CONFIG)
  eq('sanitizeConfig minSteps>20 clamps', cfg.minSteps, 20)
}
{
  const cfg = sanitizeConfig({ minSteps: 7 }, DEFAULT_CONFIG)
  eq('sanitizeConfig minSteps valid', cfg.minSteps, 7)
}
{
  const cfg = sanitizeConfig({ mode: 'off' }, DEFAULT_CONFIG)
  eq('sanitizeConfig mode=off', cfg.mode, 'off')
}
{
  const cfg = sanitizeConfig({ mode: 'ask' }, DEFAULT_CONFIG)
  eq('sanitizeConfig mode=ask', cfg.mode, 'ask')
}
{
  const cfg = sanitizeConfig({ mode: 'auto' }, DEFAULT_CONFIG)
  eq('sanitizeConfig mode=auto', cfg.mode, 'auto')
}
{
  const cfg = sanitizeConfig({ mode: 'invalid' }, DEFAULT_CONFIG)
  eq('sanitizeConfig mode invalid kept as previous', cfg.mode, DEFAULT_CONFIG.mode)
}
{
  const cfg = sanitizeConfig({ helpers: { 'our-free-model:model1': null } }, { ...DEFAULT_CONFIG, helpers: { 'our-free-model:model1': { enabled: true } } })
  assert('sanitizeConfig helpers value null removes', !('our-free-model:model1' in cfg.helpers))
}
{
  const longNotes = 'x'.repeat(3000)
  const cfg = sanitizeConfig({ notes: longNotes }, DEFAULT_CONFIG)
  assert('sanitizeConfig notes truncated to 2000', cfg.notes.length === 2000)
}
{
  const cfg = sanitizeConfig({ enabled: false }, DEFAULT_CONFIG)
  eq('sanitizeConfig enabled boolean', cfg.enabled, false)
}
{
  const cfg = sanitizeConfig({ onboarding: { seen: true } }, DEFAULT_CONFIG)
  eq('sanitizeConfig onboarding.seen', cfg.onboarding.seen, true)
}
{
  const cfg = sanitizeConfig({ onboarding: { seen: 'yes' } }, DEFAULT_CONFIG)
  eq('sanitizeConfig onboarding non-boolean', cfg.onboarding.seen, false)
}

// ===== config v3 shape =====
{
  eq('CONFIG_VERSION is 3', CONFIG_VERSION, 3)
  eq('DEFAULT_CONFIG.plan defaults', DEFAULT_CONFIG.plan, { enabled: true, minBlocks: 2, autoTeam: true })
  eq('DEFAULT_CONFIG.failover defaults', DEFAULT_CONFIG.failover, { enabled: true, waitSteps: 6, maxRetry: 1, fallback: 'main' })
  assert('default helpers drop the deprecated mimo-v2.5-free', DEFAULT_CONFIG.helpers['our-free-model:mimo-v2.5-free'] === undefined)
  assert('default helpers ship mimo-v2.6-flash-free', DEFAULT_CONFIG.helpers['our-free-model:mimo-v2.6-flash-free']?.enabled === true)
  const deprecatedSeed = SEED_ROWS.find(row => row.model === 'mimo-v2.5-free')
  eq('SEED_ROWS marks mimo-v2.5-free unavailable', deprecatedSeed?.state, 'unavailable')
  assert('SEED_ROWS deprecated row names the replacement', String(deprecatedSeed?.detail ?? '').includes('mimo-v2.6-flash-free'))
  assert('SEED_ROWS keeps mimo-v2.6-flash-free available', SEED_ROWS.find(row => row.model === 'mimo-v2.6-flash-free')?.state === 'available')
}

// ===== sanitizeConfig: plan / failover (v3) =====
{
  const cfg = sanitizeConfig({ plan: { enabled: false, minBlocks: 3, autoTeam: false } }, DEFAULT_CONFIG)
  eq('sanitizeConfig plan fields', cfg.plan, { enabled: false, minBlocks: 3, autoTeam: false })
}
{
  const cfg = sanitizeConfig({ plan: { minBlocks: 99 } }, DEFAULT_CONFIG)
  eq('sanitizeConfig plan.minBlocks clamps to 8', cfg.plan.minBlocks, 8)
}
{
  const cfg = sanitizeConfig({ plan: { minBlocks: 1 } }, DEFAULT_CONFIG)
  eq('sanitizeConfig plan.minBlocks clamps to 2', cfg.plan.minBlocks, 2)
}
{
  const cfg = sanitizeConfig({ plan: { enabled: 'yes', autoTeam: 1 } }, DEFAULT_CONFIG)
  eq('sanitizeConfig plan non-boolean booleans kept', { enabled: cfg.plan.enabled, autoTeam: cfg.plan.autoTeam }, { enabled: true, autoTeam: true })
}
{
  const cfg = sanitizeConfig({ plan: { unknown: 1 } }, DEFAULT_CONFIG)
  assert('sanitizeConfig plan drops unknown key', !('unknown' in cfg.plan))
}
{
  const cfg = sanitizeConfig({ plan: null }, DEFAULT_CONFIG)
  eq('sanitizeConfig plan null falls back to default', cfg.plan, DEFAULT_CONFIG.plan)
}
{
  const cfg = sanitizeConfig({}, { ...DEFAULT_CONFIG, plan: { enabled: false, minBlocks: 5, autoTeam: false } })
  eq('sanitizeConfig plan untouched when not patched', cfg.plan, { enabled: false, minBlocks: 5, autoTeam: false })
}
{
  const cfg = sanitizeConfig({ failover: { enabled: false, waitSteps: 20, maxRetry: 3, fallback: 'p1:m1' } }, DEFAULT_CONFIG)
  eq('sanitizeConfig failover fields', cfg.failover, { enabled: false, waitSteps: 20, maxRetry: 3, fallback: 'p1:m1' })
}
{
  const cfg = sanitizeConfig({ failover: { waitSteps: 999 } }, DEFAULT_CONFIG)
  eq('sanitizeConfig failover.waitSteps clamps to 50', cfg.failover.waitSteps, 50)
}
{
  const cfg = sanitizeConfig({ failover: { waitSteps: 0 } }, DEFAULT_CONFIG)
  eq('sanitizeConfig failover.waitSteps 0 falls back (no hot loop)', cfg.failover.waitSteps, DEFAULT_CONFIG.failover.waitSteps)
}
{
  const cfg = sanitizeConfig({ failover: { maxRetry: 0 } }, DEFAULT_CONFIG)
  eq('sanitizeConfig failover.maxRetry 0 is meaningful', cfg.failover.maxRetry, 0)
}
{
  const cfg = sanitizeConfig({ failover: { maxRetry: 9 } }, DEFAULT_CONFIG)
  eq('sanitizeConfig failover.maxRetry clamps to 3', cfg.failover.maxRetry, 3)
}
{
  const cfg = sanitizeConfig({ failover: { fallback: 'not a key' } }, DEFAULT_CONFIG)
  eq('sanitizeConfig failover.fallback invalid to main', cfg.failover.fallback, 'main')
}
{
  const cfg = sanitizeConfig({ failover: { fallback: '' } }, DEFAULT_CONFIG)
  eq('sanitizeConfig failover.fallback empty to main', cfg.failover.fallback, 'main')
}
{
  const cfg = sanitizeConfig({ failover: null }, DEFAULT_CONFIG)
  eq('sanitizeConfig failover null falls back to default', cfg.failover, DEFAULT_CONFIG.failover)
}
{
  const cfg = sanitizeConfig({}, { ...DEFAULT_CONFIG, failover: { enabled: false, waitSteps: 30, maxRetry: 2, fallback: 'x:y' } })
  eq('sanitizeConfig failover untouched when not patched', cfg.failover, { enabled: false, waitSteps: 30, maxRetry: 2, fallback: 'x:y' })
}

// ===== buildRoster =====
{
  // Create a temporary directory
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-roster-test-'))
  
  try {
    // Write fake sibling plugin state files
    const peerDir = path.join(tmp, 'fake-lane')
    fs.mkdirSync(peerDir, { recursive: true })
    
    fs.writeFileSync(path.join(peerDir, 'catalog.json'), JSON.stringify({
      entries: ['model-a', 'model-b', 'model-c']
    }), 'utf8')
    
    fs.writeFileSync(path.join(peerDir, 'availability.json'), JSON.stringify({
      at: Date.now(),
      results: {
        'model-a': { state: 'available', ttftMs: 1200, detail: 'fast lane' },
        'model-b': { state: 'region-blocked', ttftMs: 0, detail: 'geo' },
        'model-c': { state: 'unknown', ttftMs: 0, detail: '' }
      }
    }), 'utf8')
    
    fs.writeFileSync(path.join(peerDir, 'settings.json'), JSON.stringify({ enabled: true }), 'utf8')
    
    // Fake llmModels
    const fakeLlmModels = [
      { provider: 'llm-provider', id: 'llm-model-1', name: 'LLM Model 1' },
      { provider: 'llm-provider', id: 'llm-model-2', name: 'LLM Model 2' },
      { provider: 'our-free-model', id: 'nemotron-3-ultra-free', name: 'Nemotron 3 Ultra' }
    ]
    
    const fakeConfig = {
      ...DEFAULT_CONFIG,
      peer: 'our-free-model',
      discover: { llm: true, siblings: true },
      helpers: {
        'our-free-model:nemotron-3-ultra-free': { enabled: true },
        'our-free-model:space-bunny-free': { enabled: true },
        'fake-lane:model-a': { enabled: true },
        'manual-provider:manual-model': { enabled: true }
      }
    }
    
    const roster = buildRoster({
      home: tmp,
      config: fakeConfig,
      llmModels: fakeLlmModels,
      llmError: ''
    })
    
    // Assert: three sources merged, the same provider:model is marked verified by the llm source
    const nemotronRow = roster.rows.find(r => r.key === 'our-free-model:nemotron-3-ultra-free')
    assert('buildRoster llm verified marks nemotron', nemotronRow?.verified === true)
    
    // Assert: availability source carries state and ttftMs
    const modelA = roster.rows.find(r => r.key === 'fake-lane:model-a')
    assert('buildRoster peer model-a has state available', modelA?.state === 'available')
    assert('buildRoster peer model-a has ttftMs', modelA?.ttftMs === 1200)
    assert('buildRoster peer model-a has detail', modelA?.detail === 'fast lane')
    
    const modelB = roster.rows.find(r => r.key === 'fake-lane:model-b')
    assert('buildRoster peer model-b region-blocked', modelB?.state === 'region-blocked')
    
    const modelC = roster.rows.find(r => r.key === 'fake-lane:model-c')
    assert('buildRoster peer model-c unknown', modelC?.state === 'unknown')
    
    // Assert: sources counts are correct
    assert('buildRoster sources.llm > 0', roster.sources.llm > 0)
    assert('buildRoster sources.peer > 0', roster.sources.peer > 0)
    assert('buildRoster sources.seed > 0', roster.sources.seed > 0)
    assert('buildRoster sources.manual > 0', roster.sources.manual > 0)
    
    // Assert: returned rows are stably sorted (available and fast ones first)
    const availableRows = roster.rows.filter(r => r.state === 'available')
    let sorted = true
    for (let i = 1; i < availableRows.length; i++) {
      if (availableRows[i - 1].ttftMs > availableRows[i].ttftMs) {
        sorted = false
        break
      }
    }
    assert('buildRoster available rows sorted by ttftMs asc', sorted)
    
    // Assert: peers summary is correct
    assert('buildRoster peers array length', roster.peers.length === 1)
    assert('buildRoster peer name', roster.peers[0]?.name === 'fake-lane')
    assert('buildRoster peer models count', roster.peers[0]?.models === 3)
    assert('buildRoster peer enabled', roster.peers[0]?.enabled === true)
    
    // Assert: llmError is exposed
    assert('buildRoster llmError field exists', 'llmError' in roster)
    eq('buildRoster llmError empty', roster.llmError, '')
    
  } finally {
    // Clean up the temporary directory
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

// Test buildRoster with llmError
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-roster-test-'))
  try {
    const fakeConfig = { ...DEFAULT_CONFIG, peer: 'test-peer', discover: { llm: true, siblings: false }, helpers: {} }
    const roster = buildRoster({
      home: tmp,
      config: fakeConfig,
      llmModels: [],
      llmError: 'connection refused'
    })
    eq('buildRoster llmError passed through', roster.llmError, 'connection refused')
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

// ===== renderPolicy =====
{
  const fakeRoster = {
    rows: [
      { key: 'p1:m1', provider: 'p1', model: 'm1', state: 'available', ttftMs: 1000, verified: true, found: ['llm'], source: 'llm', detail: '' },
      { key: 'p2:m2', provider: 'p2', model: 'm2', state: 'region-blocked', ttftMs: 0, verified: false, found: ['peer'], source: 'peer', detail: 'geo' },
      { key: 'p3:m3', provider: 'p3', model: 'm3', state: 'unavailable', ttftMs: 0, verified: false, found: ['seed'], source: 'seed', detail: '' }
    ],
    peers: [],
    sources: { llm: 1, peer: 1, manual: 0, seed: 1 },
    scannedAt: Date.now(),
    llmError: '',
    defaultProvider: 'our-free-model',
    measured: true,
    live: true
  }
  
  // mode off
  const offConfig = { ...DEFAULT_CONFIG, enabled: false, mode: 'off' }
  const offText = renderPolicy(offConfig, fakeRoster)
  assert('renderPolicy mode=off contains explicit no-dispatch', offText.includes('不派活给任何其他 agent'))
  assert('renderPolicy mode=off mentions workflow', offText.includes('workflow'))
  assert('renderPolicy mode=off mentions subagent', offText.includes('subagent'))
  assert('renderPolicy mode=off mentions Agent Teams', offText.includes('Agent Teams'))
  assert('renderPolicy mode=off mentions Agency 专家', offText.includes('Agency 专家'))
  
  // mode ask
  const askConfig = { ...DEFAULT_CONFIG, enabled: true, mode: 'ask', helpers: { 'p1:m1': { enabled: true } }, channels: { workflow: true, subagent: true, experts: false, teams: false }, maxHelpers: 4, minSteps: 3, longTaskOnly: true, notes: 'test note', primary: 'p1:m1' }
  const askText = renderPolicy(askConfig, fakeRoster)
  assert('renderPolicy mode=ask shows 询问', askText.includes('询问'))
  assert('renderPolicy armed only lists checked', askText.includes('p1:m1'))
  assert('renderPolicy unarmed not listed', !askText.includes('p2:m2'))
  // Rows that are checked but in a bad state: get a warning + the "don't use" callout
  const blockedConfig = { ...askConfig, helpers: { 'p1:m1': { enabled: true }, 'p2:m2': { enabled: true }, 'p3:m3': { enabled: true } } }
  const blockedText = renderPolicy(blockedConfig, fakeRoster)
  assert('renderPolicy 勾了但地区受限的行会带警示', blockedText.includes('p2:m2') && blockedText.includes('地区受限'))
  assert('renderPolicy 勾了但不可用的行会带警示', blockedText.includes('p3:m3') && blockedText.includes('暂不可用') && blockedText.includes('标了地区受限/不可用的别用'))
  assert('renderPolicy maxHelpers appears', askText.includes('最多同时派 4'))
  assert('renderPolicy minSteps appears', askText.includes('超过 3 步'))
  assert('renderPolicy longTaskOnly appears', askText.includes('短任务不要派'))
  assert('renderPolicy notes appears', askText.includes('用户附加要求：test note'))
  assert('renderPolicy ask mode sentence', askText.includes('询问模式：派活前先用一句话问用户'))
  assert('renderPolicy division sentence', askText.includes('简单的活优先派出去，难的活自己做'))
  assert('renderPolicy unchecked channel forbidden', askText.includes('Agent Teams 本轮未授权'))
  assert('renderPolicy unchecked experts forbidden', askText.includes('Agency 专家本轮未授权'))
  
  // primary fallback when primary not in armed
  const fallbackConfig = { ...askConfig, primary: 'p999:notexist' }
  const fallbackText = renderPolicy(fallbackConfig, fakeRoster)
  assert('renderPolicy primary fallback', fallbackText.includes('p1:m1') && fallbackText.includes('★默认'))
  
  // mode auto
  const autoConfig = { ...askConfig, mode: 'auto' }
  const autoText = renderPolicy(autoConfig, fakeRoster)
  assert('renderPolicy mode=auto shows 自动', autoText.includes('自动'))
  assert('renderPolicy auto mode sentence', autoText.includes('自动模式：满足上面的条件就直接派'))

  // ── v3: pre-flight estimate ──
  assert('renderPolicy plan block appears', askText.includes('动工前预估（每次动工先做这一步'))
  assert('renderPolicy plan three questions', askText.includes('三问：这份活能拆成几块互不依赖的独立材料吗'))
  assert('renderPolicy plan worth-dispatching line', askText.includes('三问都是「是」→ 值得派'))
  assert('renderPolicy plan one-sentence rule', askText.includes('预估只占一句话'))
  assert('renderPolicy plan teams not armed', askText.includes('本轮 Agent Teams 未授权，不要建队'))

  const teamsConfig = { ...askConfig, channels: { ...askConfig.channels, teams: true } }
  const teamsText = renderPolicy(teamsConfig, fakeRoster)
  assert('renderPolicy teams auto-team create line', teamsText.includes('直接调用 agent_teams_create 建队'))
  assert('renderPolicy teams auto-team keeps ask-first in ask mode', teamsText.includes('询问模式下建队前仍先问用户一次'))
  assert('renderPolicy teams armed lifts the forbidden line', !teamsText.includes('Agent Teams 本轮未授权'))
  assert('renderPolicy teams observe uses task board', teamsText.includes('agent_teams_status 看任务板和成员状态'))
  assert('renderPolicy teams handover uses reassign', teamsText.includes('agent_teams_reassign_task'))
  const teamsAutoText = renderPolicy({ ...teamsConfig, mode: 'auto' }, fakeRoster)
  assert('renderPolicy teams auto mode drops ask-first caveat', !teamsAutoText.includes('询问模式下建队前仍先问用户一次'))

  const lockedText = renderPolicy({ ...teamsConfig, plan: { ...DEFAULT_CONFIG.plan, autoTeam: false } }, fakeRoster)
  assert('renderPolicy autoTeam off keeps explicit-request rule', lockedText.includes('仍需用户明确要求才调用 agent_teams_create'))
  assert('renderPolicy autoTeam off drops create line', !lockedText.includes('直接调用 agent_teams_create 建队'))

  const planOffText = renderPolicy({ ...askConfig, plan: { ...DEFAULT_CONFIG.plan, enabled: false } }, fakeRoster)
  assert('renderPolicy plan off one-liner', planOffText.includes('动工前预估本轮未开启'))
  assert('renderPolicy plan off drops questions', !planOffText.includes('三问：这份活'))
  assert('renderPolicy plan off drops team line', !planOffText.includes('拆出 ≥'))

  // ── v3: stall failover ──
  assert('renderPolicy failover block appears', askText.includes('卡住就换人（本轮要求）'))
  assert('renderPolicy failover waitSteps value', askText.includes('你已经推进/等待了 6 步'))
  assert('renderPolicy failover observe without teams', askText.includes('list_agents 看它是否还在动'))
  assert('renderPolicy failover subagent handover', askText.includes('interrupt_agent 掐掉卡住的'))
  assert('renderPolicy failover handover without subagent', (() => {
    const text = renderPolicy({ ...askConfig, channels: { ...askConfig.channels, subagent: false } }, fakeRoster)
    return text.includes('换一个已勾选的帮手把这块活重开')
  })())
  assert('renderPolicy failover retry count', askText.includes('同一个活最多改派 1 次'))
  assert('renderPolicy failover switches the model before the member', askText.includes('换人先换模型') && askText.includes('同一个模型换个成员没有意义'))
  assert('renderPolicy helper list is a probe snapshot, not an admission gate', askText.includes('这只是探测快照') && askText.includes('不代表模型没有被弃用或限流'))
  assert('renderPolicy failover main fallback', askText.includes('你（主 agent）自己接手做完，不要再外派'))
  assert('renderPolicy failover carries constraints over', askText.includes('别让接手方从零重来'))
  assert('renderPolicy failover no idle waiting', askText.includes('等待期间不要整轮空转'))
  assert('renderPolicy failover named fallback', renderPolicy({ ...askConfig, failover: { ...DEFAULT_CONFIG.failover, fallback: 'p1:m1' } }, fakeRoster).includes('交给 p1:m1 收尾'))

  const noRetryText = renderPolicy({ ...askConfig, failover: { ...DEFAULT_CONFIG.failover, maxRetry: 0 } }, fakeRoster)
  assert('renderPolicy failover maxRetry 0 line', noRetryText.includes('本轮不重试，一次没成直接走兜底'))
  assert('renderPolicy failover maxRetry 0 drops count', !noRetryText.includes('同一个活最多改派'))
  assert('renderPolicy failover maxRetry 0 keeps fallback', noRetryText.includes('走兜底：你（主 agent）自己接手做完'))

  const noFailoverText = renderPolicy({ ...askConfig, failover: { ...DEFAULT_CONFIG.failover, enabled: false } }, fakeRoster)
  assert('renderPolicy failover off one-liner', noFailoverText.includes('超时改派本轮未开启'))
  assert('renderPolicy failover off drops block', !noFailoverText.includes('卡住就换人'))

  // off mode suppresses both new blocks, and still keeps the numbered dispatch rules
  assert('renderPolicy mode=off has no plan block', !offText.includes('动工前预估'))
  assert('renderPolicy mode=off has no failover block', !offText.includes('卡住就换人'))
  const askRuleNumbers = askText.split('派活规则：')[1].match(/^\d+\./gm) ?? []
  eq('renderPolicy dispatch rules stay numbered 1..9', askRuleNumbers.length, 9)
}

// ===== providerList =====
{
  const fakeRoster = {
    rows: [
      { key: 'p1:m1', provider: 'p1', model: 'm1', ttftMs: 100, verified: true },
      { key: 'p1:m2', provider: 'p1', model: 'm2', ttftMs: 200, verified: false },
      { key: 'p2:m1', provider: 'p2', model: 'm1', ttftMs: 0, verified: false }
    ],
    defaultProvider: 'p1',
    measured: true,
    live: true
  }
  const llmCatalog = { providers: ['p1', 'p3'], models: [] }
  const list = providerList(fakeRoster, llmCatalog)
  assert('providerList includes registered providers', list.some(p => p.id === 'p1' && p.registered === true))
  assert('providerList includes default provider even if not registered', list.some(p => p.id === 'p1'))
  assert('providerList counts models', list.find(p => p.id === 'p1')?.models === 2)
  assert('providerList counts measured', list.find(p => p.id === 'p1')?.measured === 2)
  assert('providerList sorts registered first', list[0].registered === true)
}

// ===== Summary =====
results.push(`\n# ${pass} passed, ${fail} failed`)
if (fail > 0) {
  process.exitCode = 1
}
console.log(results.join('\n'))