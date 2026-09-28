/**
 * dsh-agent-dispatch — helper dispatch (host half).
 *
 * In one line: turn "may the main agent hand work to other agents, and which ones" into
 * something visible and clickable in a panel — and it really takes effect: the policy is injected
 * into every step as a systemPrompt section, and the main agent decides from it whether to dispatch.
 *
 * Four jobs:
 *   1. A persisted config ($DSH_HOME/agent-dispatch/config.json): master switch, mode
 *      (off / ask / auto), allowed helper channels, checked helper models, concurrency cap.
 *   2. The helper roster (the point of this version: it depends on no other plugin). Three sources merged:
 *      a) real `ctx.llm` enumeration: which providers / models the host has actually registered;
 *      b) sibling plugin state files: $DSH_HOME/<any plugin dir>/{catalog,availability}.json
 *         (no plugin name is hard-coded; whatever is found is used, together with its measured TTFT);
 *      c) the built-in reference roster plus the provider:model pairs typed into the panel.
 *      With all three sources absent nothing is lost: the panel still works and one manual entry is enough to dispatch.
 *   3. First-run onboarding: a four-step guide at the top of the panel plus a `settings.onboarding`
 *      slot card; `onboarding.seen` is persisted, so it stops once it has been read.
 *   4. The systemPrompt section `agent-dispatch:policy`: renders the above into the Chinese policy text,
 *      with concrete call shapes and the token-saving rationale; when off it injects an explicit "do not dispatch".
 *
 * Services come only from `ctx`, and only through nested `ctx.inject` fibers waiting for webServer /
 * systemPrompt / llm: a missing service only removes one feature, it never leaves the plugin hanging
 * (a trap this repository has already hit: naming an absent service in `inject` = a permanently pending fiber).
 *
 * @module index.js
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** Stable Cordis plugin name (matches the id in cordis.patch.yml). */
export const name = 'agent-dispatch'

/** The plugin hard-depends on no service: each one is acquired opportunistically in a nested fiber. */
export const inject = []

/** State directory name (under $DSH_HOME, alongside the rest of the DSH user data). */
const DATA_DIR_NAME = 'agent-dispatch'
/** Config file name. */
const CONFIG_FILE = 'config.json'
/** HTTP API prefix (the browser half reads it). */
const API_PREFIX = '/api/agent-dispatch'
/** Default provider: it only says whose account the built-in reference roster hangs under; the model need not exist here. */
const DEFAULT_PEER = 'our-free-model'
/** Config schema version; v1 (0.1.0) helper keys carry no provider prefix and are migrated on load. */
const CONFIG_VERSION = 2
/** Roster cache window: opening the panel repeatedly does not query the llm service every time. */
const ROSTER_TTL_MS = 20_000

/** Allowed helper channel ids (this order is the panel order). */
const CHANNEL_IDS = ['workflow', 'subagent', 'experts', 'teams']

/** Channel descriptions (the injected text and the panel share this single wording). */
const CHANNELS = [
  {
    id: 'workflow',
    label: 'workflow 扇出',
    hint: '一个脚本里并排跑多个独立子任务，可逐项指定 provider/model',
    prompt: 'workflow 工具：脚本里用 agent(prompt,{provider,model}) 扇出多个帮手，适合「多份互不依赖的调研/审计/迁移」',
  },
  {
    id: 'subagent',
    label: '子代理单派',
    hint: '把一整块独立任务丢给另一个上下文，只收回结果',
    prompt: 'subagent / subagent_fork：把一整块自包含的活丢给另一个上下文，主会话只读回结果',
  },
  {
    id: 'experts',
    label: 'Agency 专家',
    hint: '按领域召唤专家人格（需在设置里已启用）',
    prompt: 'Agency 专家（summon_expert / summon_experts / 专家团）：按领域召唤专家人格做对口工作',
  },
  {
    id: 'teams',
    label: 'Agent Teams 团队',
    hint: '多成员共享任务板协作（只有用户明确要求才建队）',
    prompt: 'Agent Teams（agent_teams_*）：多成员共享任务板；只有用户明确要求时才建队',
  },
]

/**
 * The built-in **reference** roster.
 *
 * It does two things: keeps the panel non-empty on first open, and — when sibling plugins and
 * llm enumeration yield nothing — hints at what a common free helper on this machine looks like. **It is not a source of truth**:
 * every row is labelled with its source, and `verified` means the host llm service really registered that model.
 * The latency figures are one snapshot measured from this machine on 2026-09-28 and are always labelled "reference".
 */
const SEED_ROWS = [
  { provider: 'our-free-model', model: 'nemotron-3.5-lightning-free', state: 'available', ttftMs: 1150 },
  { provider: 'our-free-model', model: 'ling-3.0-flash-fin-free', state: 'available', ttftMs: 1150 },
  { provider: 'our-free-model', model: 'space-bunny-free', state: 'available', ttftMs: 1580 },
  { provider: 'our-free-model', model: 'longcat-2.5-preview-free', state: 'available', ttftMs: 1810 },
  { provider: 'our-free-model', model: 'mimo-v2.6-flash-free', state: 'available', ttftMs: 2040 },
  { provider: 'our-free-model', model: 'mimo-v2.5-free', state: 'available', ttftMs: 2450 },
  { provider: 'our-free-model', model: 'nemotron-3-ultra-free', state: 'available', ttftMs: 6850 },
  { provider: 'our-free-model', model: 'muse-spark-1.3-contributor-free', state: 'region-blocked', ttftMs: 0 },
  { provider: 'our-free-model', model: 'muse-spark-1.2-contributor-free', state: 'region-blocked', ttftMs: 0 },
  { provider: 'our-free-model', model: 'deepseek-v4-flash-free', state: 'unavailable', ttftMs: 0 },
  { provider: 'our-free-model', model: 'jev-1.13-free', state: 'unknown', ttftMs: 0 },
]

/** Factory default: on, ask mode, two channels, the measured-available free models checked, cap 4. */
const DEFAULT_CONFIG = {
  version: CONFIG_VERSION,
  enabled: true,
  mode: 'ask',
  peer: DEFAULT_PEER,
  discover: { llm: true, siblings: true },
  channels: { workflow: true, subagent: true, experts: false, teams: false },
  helpers: {
    'our-free-model:nemotron-3-ultra-free': { enabled: true },
    'our-free-model:nemotron-3.5-lightning-free': { enabled: true },
    'our-free-model:space-bunny-free': { enabled: true },
    'our-free-model:longcat-2.5-preview-free': { enabled: true },
    'our-free-model:ling-3.0-flash-fin-free': { enabled: true },
    'our-free-model:mimo-v2.5-free': { enabled: true },
  },
  primary: 'our-free-model:nemotron-3-ultra-free',
  maxHelpers: 4,
  minSteps: 3,
  longTaskOnly: true,
  onboarding: { seen: false },
  notes: '',
}

export function apply(ctx, config) {
  const logger = ctx.logger ?? console
  const home = resolveDshHome()
  const dataDir = path.join(home, DATA_DIR_NAME)
  const configPath = path.join(dataDir, CONFIG_FILE)
  try { fs.mkdirSync(dataDir, { recursive: true }) } catch { /* 只读环境：内存配置照常工作 */ }

  /** Service connection state (shown in the panel host-adaptation block to explain why a feature is absent). */
  const services = { webServer: false, systemPrompt: false, llm: false }
  /** Result of the llm enumeration (on failure the reason is kept and shown as-is). */
  let llmCatalog = { providers: [], models: [], error: '', at: 0 }
  let llmService = undefined

  let current = loadConfig(configPath, config)
  let roster = buildRoster({ home, config: current, llmModels: llmCatalog.models, llmError: llmCatalog.error })
  let rosterAt = Date.now()

  // ── Persistence ────────────────────────────────────────────────────────────────────
  function persist() {
    try {
      const tmp = `${configPath}.tmp`
      fs.writeFileSync(tmp, `${JSON.stringify(current, null, 2)}\n`, 'utf8')
      fs.renameSync(tmp, configPath)
      return ''
    } catch (error) {
      const message = String(error?.message ?? error)
      logger.warn?.(`agent-dispatch: 配置写入失败（${message}）`)
      return message
    }
  }

  /** Rebuild the roster: refresh from llm when present, then merge the three sources. */
  async function rescan() {
    await refreshLlm()
    roster = buildRoster({ home, config: current, llmModels: llmCatalog.models, llmError: llmCatalog.error })
    rosterAt = Date.now()
    return roster
  }

  async function refreshLlm(force = false) {
    if (llmService === undefined || current.discover?.llm !== true) return
    if (!force && Date.now() - llmCatalog.at < ROSTER_TTL_MS) return
    try {
      const providers = await Promise.resolve(llmService.listProviders?.() ?? [])
      const models = []
      for (const provider of Array.isArray(providers) ? providers : []) {
        const id = String(provider?.id ?? '').trim()
        if (id === '') continue
        try {
          const listed = await llmService.listModels?.(id)
          for (const model of Array.isArray(listed) ? listed : []) {
            const modelId = String(model?.id ?? '').trim()
            if (modelId === '') continue
            models.push({ provider: id, model: modelId, name: String(model?.name ?? '') })
          }
        } catch { /* 单个 provider 取不到就跳过，不影响其他 */ }
      }
      llmCatalog = { providers: (Array.isArray(providers) ? providers : []).map(p => String(p?.id ?? '')).filter(Boolean), models, error: '', at: Date.now() }
    } catch (error) {
      llmCatalog = { ...llmCatalog, error: String(error?.message ?? error), at: Date.now() }
    }
  }

  /** Injected text: the single source of truth; the panel preview and the systemPrompt use this same function. */
  const policyText = () => renderPolicy(current, roster)

  const health = () => ({
    services: { ...services },
    home,
    dataDir,
    configPath,
    writable: canWrite(dataDir),
    onboardingSeen: current.onboarding?.seen === true,
    roster: {
      total: roster.rows.length,
      available: roster.rows.filter(row => row.state === 'available').length,
      verified: roster.rows.filter(row => row.verified === true).length,
      sources: countSources(roster.rows),
      scannedAt: roster.scannedAt,
    },
    peers: roster.peers,
    llm: { providers: llmCatalog.providers, modelCount: llmCatalog.models.length, error: llmCatalog.error, at: llmCatalog.at },
  })

  const summary = () => ({
    config: current,
    roster,
    providers: providerList(roster, llmCatalog),
    channels: CHANNELS.map(channel => ({ id: channel.id, label: channel.label, hint: channel.hint })),
    preview: policyText(),
    health: health(),
    stats: {
      rosterTotal: roster.rows.length,
      available: roster.rows.filter(row => row.state === 'available').length,
      armed: roster.rows.filter(row => current.helpers[row.key]?.enabled === true).length,
      channels: CHANNEL_IDS.filter(id => current.channels?.[id] === true).length,
    },
    meta: { pluginVersion: PACKAGE_VERSION, configVersion: CONFIG_VERSION, peer: DEFAULT_PEER },
  })

  // ── Browser-facing HTTP API ───────────────────────────────────────────────────────
  const handler = async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const route = url.pathname.slice(API_PREFIX.length).replace(/\/+$/, '') || '/'
    const method = String(req.method ?? 'GET').toUpperCase()
    const send = (status, payload) => {
      const body = JSON.stringify(payload)
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(body)
    }
    if (!isLoopbackRequest(req)) return send(403, { error: 'forbidden' })
    try {
      if (method === 'GET' && (route === '/summary' || route === '/health')) {
        if (route === '/health') return send(200, health())
        await refreshLlm()
        if (Date.now() - rosterAt >= ROSTER_TTL_MS) await rescan()
        return send(200, summary())
      }
      if (method === 'POST' && route === '/config') {
        const body = await readJsonBody(req)
        current = sanitizeConfig(body?.patch ?? body, current)
        const writeError = persist()
        roster = buildRoster({ home, config: current, llmModels: llmCatalog.models, llmError: llmCatalog.error })
        rosterAt = Date.now()
        return send(200, { ...summary(), writeError })
      }
      if (method === 'POST' && route === '/rescan') {
        await rescan()
        return send(200, summary())
      }
      if (method === 'POST' && route === '/reset') {
        // Reset means real replacement, not a merge: manually typed or extra helper keys are cleared too.
        current = sanitizeConfig(structuredClone(DEFAULT_CONFIG), structuredClone(DEFAULT_CONFIG))
        const writeError = persist()
        await rescan()
        return send(200, { ...summary(), writeError })
      }
      return send(404, { error: 'not found' })
    } catch (error) {
      return send(500, { error: String(error?.message ?? error) })
    }
  }

  if (typeof ctx.inject === 'function') {
    // Idempotent: it may run again (cordis re-enters when a service is replaced).
    let mounted = false
    ctx.inject(['webServer'], scoped => {
      if (mounted) return
      mounted = true
      services.webServer = true
      const server = scoped.webServer
      scoped.effect(() => server.register({ kind: 'prefix', path: API_PREFIX, handler }), 'agent-dispatch: api routes')
      logger.info?.(`agent-dispatch: 面板 API 挂在 ${API_PREFIX}`)
    })

    // systemPrompt section: rendered from the current config on every step, so a toggle takes effect at once.
    ctx.inject(['systemPrompt'], scoped => {
      services.systemPrompt = true
      scoped.effect(() => scoped.systemPrompt.section({
        name: 'agent-dispatch:policy',
        order: 180,
        text: policyText,
      }), 'agent-dispatch: policy section')
      logger.info?.(`agent-dispatch: 策略已注入（${current.enabled === false ? '关闭' : current.mode}·${summary().stats.armed} 个帮手）`)
    })

    // llm service: wired only to learn which provider/model the host has (optional).
    ctx.inject(['llm'], scoped => {
      services.llm = true
      llmService = scoped.llm
      scoped.effect(() => () => { llmService = undefined; services.llm = false }, 'agent-dispatch: llm observer')
      void rescan()
    })
  } else {
    // Minimal composition without a nested fiber: try to attach directly (a failure only drops one feature).
    try {
      const promptService = ctx.get?.('systemPrompt')
      promptService?.section?.({ name: 'agent-dispatch:policy', order: 180, text: policyText })
      if (promptService !== undefined) services.systemPrompt = true
    } catch { /* 无 systemPrompt 服务 */ }
    try {
      const llm = ctx.get?.('llm')
      if (llm !== undefined) { llmService = llm; services.llm = true; void rescan() }
    } catch { /* 无 llm 服务 */ }
  }

  ctx.effect?.(() => () => { /* 无外部资源需要释放；配置已即时落盘 */ }, 'agent-dispatch: dispose')
}

// ── Policy text ─────────────────────────────────────────────────────────────────

/**
 * Renders config + roster into the policy section injected to the main agent.
 *
 * The wording is deliberate, so the model cannot improvise:
 *   - off means an explicit ban on dispatching, not "allowed but unchecked";
 *   - the helper list carries **checked** models only, each labelled host-registered, lane-verified or unverified reference;
 *   - the dispatch rules spell out what may be handed out and what must stay here, because saving tokens
 *     means moving self-contained work out, not moving the key decisions out;
 *   - helper output is material, not a conclusion: the main agent verifies it before delivering.
 */
function renderPolicy(config, roster) {
  const mode = config.enabled === false ? 'off' : config.mode
  if (mode === 'off') {
    return [
      '【帮手调度台 · 关闭】本次会话不派活给任何其他 agent：不用 workflow 扇出、不召唤 subagent、不建 Agent Teams、不召唤 Agency 专家。所有工作由你（主 agent）自己完成。',
      '（这条状态由 dsh-agent-dispatch 插件按面板配置注入；用户随时可以在 设置 → 帮手调度 里打开。）',
    ].join('\n')
  }

  const rows = roster?.rows ?? []
  const armed = rows.filter(row => config.helpers?.[row.key]?.enabled === true)
  const usable = armed.filter(row => row.state !== 'unavailable' && row.state !== 'region-blocked')
  const primary = pickPrimary(config, armed, usable)
  const enabledChannels = CHANNELS.filter(channel => config.channels?.[channel.id] === true)

  const lines = []
  lines.push(`【帮手调度台 · 已开启｜模式：${mode === 'auto' ? '自动' : '询问'}】`)
  lines.push('分工原则：免费车道的帮手承担「简单、机械、自包含、不依赖主会话上下文」的活（批量检索、逐项审计、抄改重排、列清单、翻译、格式化、初稿）；你（主 agent，付费车道）只保留最复杂、最难、最需要判断并在意后果的部分——架构与关键设计、跨模块推理、正确性与安全判断、分歧裁决、用户要的最终交付。简单的活优先派出去，难的活自己做。')

  if (enabledChannels.length === 0) {
    lines.push('当前没有勾选任何帮手通道 —— 也就是说这轮不允许派活（面板里勾选通道后才算数）。')
  } else {
    lines.push('')
    lines.push('允许的帮手通道：')
    for (const channel of enabledChannels) {
      lines.push(`- ${channel.prompt}${channel.id === 'teams' ? '（仍需用户明确要求）' : ''}`)
    }
    if (config.channels?.teams !== true) lines.push('- Agent Teams 本轮未授权：不要调用 agent_teams_create 建队。')
    if (config.channels?.experts !== true) lines.push('- Agency 专家本轮未授权：不要调用 summon_expert / summon_experts。')
  }

  lines.push('')
  if (armed.length === 0) {
    lines.push('当前没有勾选任何帮手模型 —— 请求里带 provider/model 时必须留空或沿用主车道，不要自行挑一个模型顶上。')
  } else {
    lines.push('勾选可用的帮手模型（按实测首字延迟排序；标注说明见行尾）：')
    for (const row of armed) {
      const mark = row.key === primary ? ' ★默认' : ''
      const latency = row.state === 'available' && row.ttftMs > 0 ? `${(row.ttftMs / 1000).toFixed(2)}s` : stateLabel(row.state)
      const tag = row.state === 'available' && row.ttftMs > 0 ? '实测' : (row.verified === true ? '宿主已注册' : '未核验')
      const extra = row.state === 'available' ? '' : `${row.detail ? `：${row.detail}` : ''}`
      lines.push(`- ${row.key}（${latency}｜${tag}${extra}）${mark}`)
    }
    const call = primary ? splitKey(primary) : splitKey(armed[0].key)
    lines.push(`调用形参：{ provider: '${call.provider}', model: '${call.model}' }${usable.length < armed.length ? '（标了地区受限/不可用的别用，会直接失败）' : ''}`)
  }

  lines.push('')
  const primaryHint = primary ? `，优先用默认主力 ${primary}` : ''
  const rules = []
  rules.push('先判断「这件事难不难」：一句话能说清、答案不依赖你的上下文、做错也能一眼看出来的活 → 默认派给免费帮手；只有当你确实是把它做完成本最低的人时，才自己动手。')
  rules.push('只有「能写成一段自包含 prompt」「不依赖主会话上下文」「产出是一份独立材料」的任务才派出去；一体化设计、关键判断、最终交付由你自己完成。')
  rules.push(`一次最多同时派 ${config.maxHelpers} 个帮手${primaryHint}；同一批任务请在一条消息里一起发出。`)
  if (config.longTaskOnly === true) {
    rules.push(`只在本任务预计超过 ${config.minSteps} 步、或确实能并行拆分时才考虑派活；一句能答完的短任务不要派。`)
  }
  rules.push(mode === 'auto' ? '自动模式：满足上面的条件就直接派，不必先问。' : '询问模式：派活前先用一句话问用户「要不要派帮手、派几个」，得到同意再派。')
  rules.push('帮手的 prompt 必须自包含：写清目标、可用资料路径、约束与验收口径（它们看不到你的对话历史）。')
  rules.push('帮手给的是材料不是事实：收到后你自己核对，再从主会话落最终交付。')
  rules.push('免费车道可能限流或按地区放行，失败就自己接手，同一个帮手不要重试超过一次。')
  rules.push('省 token 的机理：你每往前一步都要重发完整上下文（按 cacheMiss 计费），而帮手各自独立上下文、且免费车道输入输出零成本——所以「把简单活挪出去」通常比自己接完更省；但核对与拍板那一步永远留在你这里。')
  lines.push('派活规则：')
  rules.forEach((rule, index) => { lines.push(`${index + 1}. ${rule}`) })
  if (typeof config.notes === 'string' && config.notes.trim() !== '') {
    lines.push('')
    lines.push(`用户附加要求：${config.notes.trim()}`)
  }
  return lines.join('\n')
}

/** primary must be a checked roster entry; otherwise it falls back to the first available one. */
function pickPrimary(config, armed, usable) {
  if (config.primary && armed.some(row => row.key === config.primary)) return config.primary
  return usable[0]?.key ?? armed[0]?.key ?? ''
}

function stateLabel(state) {
  switch (state) {
    case 'available': return '可用'
    case 'region-blocked': return '地区受限'
    case 'unavailable': return '暂不可用'
    case 'throttled': return '已达限额'
    default: return '未探测'
  }
}

// ── Roster ─────────────────────────────────────────────────────────────────────

/**
 * Merges the three sources into one roster. **Pure function**: it only takes home + config + llm enumeration,
 * so tests can feed it fake data directly (which is what scripts/selftest.mjs does).
 *
 * Merge priority when several sources mention the same provider:model:
 *   llm enumeration → sets verified=true (the host really registered it);
 *   sibling plugin availability.json → sets state / ttftMs (the only source of measured latency);
 *   built-in reference roster → fills in appearance only, never overriding the two verdicts above.
 */
function buildRoster({ home, config, llmModels = [], llmError = '' }) {
  const map = new Map()
  const sources = { llm: 0, peer: 0, manual: 0, seed: 0 }
  const peers = []

  const merge = (incoming) => {
    const previous = map.get(incoming.key)
    if (previous === undefined) { map.set(incoming.key, incoming); return }
    map.set(incoming.key, {
      ...previous,
      ...incoming,
      name: incoming.name || previous.name,
      detail: incoming.detail || previous.detail,
      state: incoming.state === 'unknown' ? previous.state : incoming.state,
      ttftMs: incoming.ttftMs > 0 ? incoming.ttftMs : previous.ttftMs,
      at: incoming.at > 0 ? incoming.at : previous.at,
      verified: previous.verified === true || incoming.verified === true,
      found: [...new Set([...(previous.found ?? []), ...(incoming.found ?? [])])],
    })
  }

  const make = (provider, model, extra = {}) => {
    const key = `${provider}:${model}`
    return {
      key,
      provider,
      model,
      name: extra.name && String(extra.name).trim() !== '' ? String(extra.name) : prettyName(model),
      label: extra.label ?? '',
      state: extra.state ?? 'unknown',
      ttftMs: Number.isFinite(Number(extra.ttftMs)) && Number(extra.ttftMs) > 0 ? Number(extra.ttftMs) : 0,
      detail: extra.detail ?? '',
      at: Number(extra.at ?? 0),
      verified: extra.verified === true,
      found: extra.found ?? [extra.source ?? 'seed'],
    }
  }

  // 1. Built-in reference roster (always present, so the panel is never empty)
  for (const seed of SEED_ROWS) {
    const provider = seed.provider || config.peer || DEFAULT_PEER
    merge(make(provider, seed.model, { ...seed, provider, source: 'seed' }))
    sources.seed += 1
  }

  // 2. Sibling plugin state files: the directory name is the provider name, no plugin is hard-coded
  if (config.discover?.siblings !== false) {
    for (const dir of listPeerDirs(home)) {
      const catalog = readJson(path.join(dir.path, 'catalog.json'))
      const availability = readJson(path.join(dir.path, 'availability.json'))
      const settings = readJson(path.join(dir.path, 'settings.json'))
      const results = availability?.results && typeof availability.results === 'object' ? availability.results : {}
      const ids = Array.isArray(catalog?.entries)
        ? catalog.entries.filter(id => typeof id === 'string' && id !== '')
        : Object.keys(results)
      peers.push({
        name: dir.name,
        path: dir.path,
        models: ids.length,
        enabled: settings?.enabled !== false,
        probedAt: Number(availability?.at ?? 0),
        egress: availability?.egress?.ip ? `${availability.egress.ip}${availability.egress.country ? ` (${availability.egress.country})` : ''}` : '',
        measured: Object.keys(results).length,
      })
      for (const id of ids) {
        const verdict = results[id]
        const state = typeof verdict?.state === 'string' ? verdict.state : 'unknown'
        merge(make(dir.name, id, {
          state,
          ttftMs: Number(verdict?.ttftMs ?? 0),
          detail: typeof verdict?.detail === 'string' ? verdict.detail : '',
          at: Number(verdict?.at ?? 0),
          verified: Object.keys(results).length > 0,
          source: 'peer',
        }))
        sources.peer += 1
      }
    }
  }

  // 3. Host llm enumeration: the only proof that this provider/model can be invoked right now
  for (const model of Array.isArray(llmModels) ? llmModels : []) {
    const provider = String(model?.provider ?? '').trim()
    const id = String(model?.id ?? '').trim()
    if (provider === '' || id === '') continue
    merge(make(provider, id, { name: model?.name, verified: true, source: 'llm' }))
    sources.llm += 1
  }

  // 4. Manual entries from the panel/config file: any provider:model is allowed, even another paid lane
  for (const [key, value] of Object.entries(config.helpers ?? {})) {
    const parsed = splitKey(key, config.peer)
    if (parsed.provider === '' || parsed.model === '') continue
    if (!map.has(`${parsed.provider}:${parsed.model}`)) {
      merge(make(parsed.provider, parsed.model, { label: value?.label, source: 'manual' }))
      sources.manual += 1
    }
  }

  const rows = [...map.values()]
    .map(row => ({ ...row, source: displaySource(row), found: [...new Set(row.found)].sort() }))
    .sort((a, b) => speedRank(a) - speedRank(b) || rankOf(a.state) - rankOf(b.state) || a.key.localeCompare(b.key))

  const defaultProvider = config.peer || DEFAULT_PEER
  return {
    rows,
    peers,
    sources,
    home,
    scannedAt: Date.now(),
    llmError: String(llmError ?? ''),
    defaultProvider,
    measured: rows.some(row => row.ttftMs > 0),
    live: rows.some(row => row.verified === true),
  }
}

/** The source tag on each panel row: lane probe > host-registered > manual > built-in. */
function displaySource(row) {
  if (row.ttftMs > 0 || row.found.includes('peer')) return 'peer'
  if (row.verified === true || row.found.includes('llm')) return 'llm'
  if (row.found.includes('manual')) return 'manual'
  return 'seed'
}

function countSources(rows) {
  const out = { peer: 0, llm: 0, manual: 0, seed: 0 }
  for (const row of rows) out[row.source] = (out[row.source] ?? 0) + 1
  return out
}

/** Provider view: used by the panel dropdown of what the host has. */
function providerList(roster, llmCatalog) {
  const known = new Map()
  for (const id of llmCatalog?.providers ?? []) known.set(id, { id, registered: true, models: 0, measured: 0 })
  if (!known.has(roster.defaultProvider)) known.set(roster.defaultProvider, { id: roster.defaultProvider, registered: false, models: 0, measured: 0 })
  for (const row of roster.rows) {
    const entry = known.get(row.provider) ?? { id: row.provider, registered: false, models: 0, measured: 0 }
    entry.models += 1
    if (row.ttftMs > 0) entry.measured += 1
    known.set(row.provider, entry)
  }
  return [...known.values()].sort((a, b) => Number(b.registered) - Number(a.registered) || a.id.localeCompare(b.id))
}

/** Scans $DSH_HOME for sibling plugin directories that look like a model lane (a catalog or availability file). */
function listPeerDirs(home) {
  const out = []
  try {
    for (const entry of fs.readdirSync(home, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith('.')) continue
      const dir = path.join(home, entry.name)
      if (!fs.existsSync(path.join(dir, 'catalog.json')) && !fs.existsSync(path.join(dir, 'availability.json'))) continue
      out.push({ name: entry.name, path: dir })
    }
  } catch { /* 目录读不到：名册只剩内置参考 */ }
  return out
}

/** Available first: by state, then by measured TTFT within the same state. */
function speedRank(row) {
  return row.state === 'available' ? row.ttftMs || Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER
}

function rankOf(state) {
  return { available: 0, unknown: 1, throttled: 2, 'region-blocked': 3, unavailable: 4 }[state] ?? 5
}

/** Helper key → {provider, model}. Keys without a provider prefix are read as the default provider. */
function splitKey(key, fallbackProvider = DEFAULT_PEER) {
  const text = String(key ?? '')
  const at = text.indexOf(':')
  if (at < 0) return { provider: fallbackProvider, model: text }
  return { provider: text.slice(0, at), model: text.slice(at + 1) }
}

/** Model id → a display name for the panel (trim the suffix, capitalize; display only). */
function prettyName(id) {
  const trimmed = String(id).replace(/-(free|preview|contributor-free)$/i, '').replace(/-free$/i, '')
  return trimmed.split(/[-_/]/).map(part => (part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))).join(' ')
}

// ── Config ─────────────────────────────────────────────────────────────────────

function resolveDshHome() {
  const fromEnv = process.env.DSH_HOME
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') return fromEnv.trim()
  return path.join(os.homedir(), '.dsh')
}

/** Read config: file first, then the config passed by the bundle patch, then the factory default. */
function loadConfig(configPath, config) {
  const fromFile = readJson(configPath)
  const seed = fromFile ?? (config && typeof config === 'object' ? config : {})
  return sanitizeConfig(seed, structuredClone(DEFAULT_CONFIG), { migrating: true })
}

const HELPER_KEY_RE = /^[A-Za-z0-9._@-]{1,64}:[A-Za-z0-9._@/-]{1,120}$/
const PROVIDER_RE = /^[A-Za-z0-9._@-]{1,80}$/
const MODEL_RE = /^[A-Za-z0-9._:@/-]{1,120}$/

/**
 * Allowlist convergence: the panel, a hand-edited file or a future script can only land on fields known here.
 * Numbers are clamped to sane ranges (0 would mean a hot loop or an accidental "no helper allowed").
 * When `opts.migrating` is true, v1 bare model keys get a provider prefix (one-time migration).
 */
function sanitizeConfig(patch, current, opts = {}) {
  const next = structuredClone(current ?? DEFAULT_CONFIG)
  const previousVersion = Number(next.version ?? 1)
  if (patch === null || typeof patch !== 'object') {
    next.version = CONFIG_VERSION
    return next
  }
  if (typeof patch.enabled === 'boolean') next.enabled = patch.enabled
  if (patch.mode === 'off' || patch.mode === 'ask' || patch.mode === 'auto') next.mode = patch.mode
  if (typeof patch.peer === 'string' && PROVIDER_RE.test(patch.peer.trim())) next.peer = patch.peer.trim()
  if (patch.discover && typeof patch.discover === 'object') {
    next.discover = {
      llm: patch.discover.llm !== false,
      siblings: patch.discover.siblings !== false,
    }
  }
  if (patch.channels && typeof patch.channels === 'object') {
    const channels = { ...next.channels }
    for (const id of CHANNEL_IDS) if (typeof patch.channels[id] === 'boolean') channels[id] = patch.channels[id]
    next.channels = channels
  }
  if (patch.helpers && typeof patch.helpers === 'object') {
    const helpers = { ...next.helpers }
    for (const [rawKey, value] of Object.entries(patch.helpers)) {
      const key = normalizeHelperKey(rawKey, next.peer, previousVersion < CONFIG_VERSION || opts.migrating === true)
      if (key === '') continue
      if (value === null) { delete helpers[key]; continue }
      helpers[key] = { enabled: value?.enabled === true, ...(typeof value?.label === 'string' && value.label.trim() !== '' ? { label: value.label.trim().slice(0, 60) } : {}) }
    }
    next.helpers = helpers
  }
  if (patch.primary !== undefined) {
    const primary = String(patch.primary ?? '').trim()
    const normalized = normalizeHelperKey(primary, next.peer, previousVersion < CONFIG_VERSION || opts.migrating === true)
    if (primary === '') next.primary = ''
    else if (normalized !== '') next.primary = normalized
  }
  if (patch.maxHelpers !== undefined) next.maxHelpers = clampInt(patch.maxHelpers, 1, 8, next.maxHelpers)
  if (patch.minSteps !== undefined) next.minSteps = clampInt(patch.minSteps, 1, 20, next.minSteps)
  if (patch.longTaskOnly !== undefined) next.longTaskOnly = patch.longTaskOnly === true
  if (patch.onboarding && typeof patch.onboarding === 'object') {
    next.onboarding = { seen: patch.onboarding.seen === true }
  }
  if (typeof patch.notes === 'string') next.notes = patch.notes.slice(0, 2000)
  next.version = CONFIG_VERSION

  // Keep checks aligned with the roster: if primary points at an unchecked model, the injected text falls back to the first checked one.
  if (next.helpers[next.primary]?.enabled !== true && Object.values(next.helpers).some(item => item?.enabled === true)) {
    next.primary = Object.entries(next.helpers).find(([, item]) => item?.enabled === true)?.[0] ?? next.primary
  }
  return next
}

/** Helper key normalization: v1 bare model names get a provider prefix; illegal keys are dropped. */
function normalizeHelperKey(rawKey, provider, migrate) {
  const text = String(rawKey ?? '').trim()
  if (HELPER_KEY_RE.test(text)) return text
  if (migrate && MODEL_RE.test(text) && !text.includes(':')) return `${provider}:${text}`
  return ''
}

function clampInt(value, min, max, fallback) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return Math.min(max, Math.max(min, Math.trunc(number)))
}

// ── Utilities ───────────────────────────────────────────────────────────────────

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return undefined }
}

function canWrite(dir) {
  try { fs.accessSync(dir, fs.constants.W_OK); return true } catch { return false }
}

function readBody(req, limit = 1024 * 512) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', chunk => {
      size += chunk.length
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function readJsonBody(req) {
  const text = await readBody(req)
  if (text.trim() === '') return {}
  return JSON.parse(text)
}

/**
 * Serves the local browser only.
 *
 * This API can change plugin behaviour and the process webServer may be bound to 0.0.0.0,
 * so any non-loopback Host gets 403 (the safe default); the panel can only come from loopback.
 */
function isLoopbackRequest(req) {
  const host = String(req.headers?.host ?? '')
  const name = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0]
  return name === '127.0.0.1' || name === 'localhost' || name === '::1' || name === ''
}

/** Read the version from this package.json (shown in the panel footer). */
const PACKAGE_VERSION = (() => {
  try {
    const file = new URL('./package.json', import.meta.url)
    return String(JSON.parse(fs.readFileSync(file, 'utf8')).version ?? '')
  } catch { return '' }
})()

/** Reused by scripts/selftest.mjs (not part of runtime). */
export const __test = {
  renderPolicy,
  buildRoster,
  sanitizeConfig,
  splitKey,
  normalizeHelperKey,
  providerList,
  DEFAULT_CONFIG,
  CONFIG_VERSION,
  CHANNELS,
  SEED_ROWS,
}
