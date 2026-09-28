/**
 * dsh-agent-dispatch 单元自测（宿主半身）。
 * 不用测试框架：自己写 assert，输出 TAP-like ok/not ok，末尾汇总。
 * 跑法：node D:\dsh-agent-dispatch\scripts\selftest.mjs
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

// ===== buildRoster =====
{
  // 创建临时目录
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-roster-test-'))
  
  try {
    // 写假的兄弟插件状态文件
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
    
    // 假的 llmModels
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
    
    // 断言：三层合并，同一条 provider:model 被 llm 来源标成 verified
    const nemotronRow = roster.rows.find(r => r.key === 'our-free-model:nemotron-3-ultra-free')
    assert('buildRoster llm verified marks nemotron', nemotronRow?.verified === true)
    
    // 断言：availability 来源带上 state 与 ttftMs
    const modelA = roster.rows.find(r => r.key === 'fake-lane:model-a')
    assert('buildRoster peer model-a has state available', modelA?.state === 'available')
    assert('buildRoster peer model-a has ttftMs', modelA?.ttftMs === 1200)
    assert('buildRoster peer model-a has detail', modelA?.detail === 'fast lane')
    
    const modelB = roster.rows.find(r => r.key === 'fake-lane:model-b')
    assert('buildRoster peer model-b region-blocked', modelB?.state === 'region-blocked')
    
    const modelC = roster.rows.find(r => r.key === 'fake-lane:model-c')
    assert('buildRoster peer model-c unknown', modelC?.state === 'unknown')
    
    // 断言：sources 计数正确
    assert('buildRoster sources.llm > 0', roster.sources.llm > 0)
    assert('buildRoster sources.peer > 0', roster.sources.peer > 0)
    assert('buildRoster sources.seed > 0', roster.sources.seed > 0)
    assert('buildRoster sources.manual > 0', roster.sources.manual > 0)
    
    // 断言：返回 rows 排序稳定（可用的、快的在前）
    const availableRows = roster.rows.filter(r => r.state === 'available')
    let sorted = true
    for (let i = 1; i < availableRows.length; i++) {
      if (availableRows[i - 1].ttftMs > availableRows[i].ttftMs) {
        sorted = false
        break
      }
    }
    assert('buildRoster available rows sorted by ttftMs asc', sorted)
    
    // 断言：peers 摘要正确
    assert('buildRoster peers array length', roster.peers.length === 1)
    assert('buildRoster peer name', roster.peers[0]?.name === 'fake-lane')
    assert('buildRoster peer models count', roster.peers[0]?.models === 3)
    assert('buildRoster peer enabled', roster.peers[0]?.enabled === true)
    
    // 断言：llmError 被透出
    assert('buildRoster llmError field exists', 'llmError' in roster)
    eq('buildRoster llmError empty', roster.llmError, '')
    
  } finally {
    // 清理临时目录
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

// 测试 buildRoster with llmError
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
  // 勾了但状态不好的行：会带警示 + 调用形参那句「别用」
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