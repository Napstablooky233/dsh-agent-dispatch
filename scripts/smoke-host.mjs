/**
 * Host half smoke test — really calls apply() once, with fake webServer / systemPrompt / llm services,
 * then uses fake req/res to hit the real self-built HTTP routes.
 *
 * Why this layer: unit self-tests (scripts/selftest.mjs) can only prove whether pure functions are correct,
 * but cannot prove "the panel actually works after install" — service-absent degradation, route registration,
 * policy changing live with config — all need to run through a real apply flow to count.
 * This is the closest-to-real-machine verification possible without restarting DSH.
 *
 * Safety: the entire process points DSH_HOME at a temporary directory, never touching the user's real $DSH_HOME/agent-dispatch/config.json.
 *
 * Run: node scripts/smoke-host.mjs
 */
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const API_PREFIX = '/api/agent-dispatch'
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-dispatch-smoke-'))
process.env.DSH_HOME = home

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok: ok === true })
  console.log(`${ok === true ? 'ok  ' : 'FAIL'} - ${name}${ok === true || detail === '' ? '' : ` — ${detail}`}`)
}

// ── Fake host ────────────────────────────────────────────────────────────────────
const routes = []
const sections = []
const disposers = []
const logger = { info() {}, warn() {}, error() {}, debug() {} }
const webServer = {
  register(route) { routes.push(route); return () => {} },
}
const systemPrompt = {
  section(definition) { sections.push(definition); return () => {} },
}
const llm = {
  listProviders() {
    return [{ id: 'our-free-model', name: 'Our free model' }, { id: 'deepseek', name: 'DeepSeek' }]
  },
  async listModels(provider) {
    if (provider === 'our-free-model') {
      return [
        { provider, id: 'nemotron-3-ultra-free', name: 'Nemotron 3 Ultra' },
        { provider, id: 'ling-3.0-flash-fin-free', name: 'Ling 3.0 Flash Fin' },
      ]
    }
    return [{ provider, id: 'deepseek-v4-flash', name: 'DeepSeek V4 Flash' }]
  },
}
const withEffect = scoped => ({
  ...scoped,
  effect(fn) {
    const disposer = fn()
    if (typeof disposer === 'function') disposers.push(disposer)
    return disposer
  },
})
const ctx = {
  logger,
  effect(fn) {
    const disposer = fn()
    if (typeof disposer === 'function') disposers.push(disposer)
    return disposer
  },
  inject(deps, scoped) {
    const bag = {}
    if (deps.includes('webServer')) bag.webServer = webServer
    if (deps.includes('systemPrompt')) bag.systemPrompt = systemPrompt
    if (deps.includes('llm')) bag.llm = llm
    scoped(withEffect(bag))
  },
  get(name) {
    if (name === 'webServer') return webServer
    if (name === 'systemPrompt') return systemPrompt
    if (name === 'llm') return llm
    return undefined
  },
}

/** One fake HTTP round-trip: the handler is the one the plugin registered into the fake webServer. */
function call(method, route, options = {}) {
  const handler = routes[0]?.handler
  if (typeof handler !== 'function') throw new Error('插件没有注册路由处理器')
  return new Promise((resolve, reject) => {
    const req = new EventEmitter()
    req.method = method
    req.url = `${API_PREFIX}${route}`
    req.headers = { host: options.host ?? '127.0.0.1:3080' }
    req.destroy = () => {}
    const res = {
      status: 0,
      headers: undefined,
      body: '',
      writeHead(status, headers) { this.status = status; this.headers = headers },
      end(chunk) {
        this.body = String(chunk ?? '')
        resolve({ status: this.status, headers: this.headers, body: this.body })
      },
    }
    Promise.resolve(handler(req, res)).catch(reject)
    process.nextTick(() => {
      if (options.raw !== undefined) req.emit('data', Buffer.from(String(options.raw), 'utf8'))
      else if (options.body !== undefined) req.emit('data', Buffer.from(JSON.stringify(options.body), 'utf8'))
      req.emit('end')
    })
  })
}

const json = response => { try { return JSON.parse(response.body) } catch { return undefined } }

// ── Run ───────────────────────────────────────────────────────────────────────
const plugin = await import(new URL('../index.js', import.meta.url))
check('index.js 导出 name / inject / apply', plugin.name === 'agent-dispatch' && Array.isArray(plugin.inject) && typeof plugin.apply === 'function', `name=${plugin.name}`)

plugin.apply(ctx, {})

check('只注册一条前缀路由，挂在 /api/agent-dispatch', routes.length === 1 && routes[0].kind === 'prefix' && routes[0].path === API_PREFIX, JSON.stringify(routes.map(r => [r.kind, r.path])))
check('注入 systemPrompt 段 agent-dispatch:policy（order 180）', sections.length === 1 && sections[0].name === 'agent-dispatch:policy' && sections[0].order === 180, JSON.stringify(sections.map(s => s.name)))
check('段 text 是每个 step 重新求值的同步闭包', typeof sections[0]?.text === 'function' && typeof sections[0].text() === 'string')

const health = await call('GET', '/health')
const healthBody = json(health)
check('GET /health → 200 且是 JSON', health.status === 200 && healthBody !== undefined && String(health.headers['content-type']).includes('application/json'), `status=${health.status}`)
check('health 报告三个服务都已连接', healthBody?.services?.webServer === true && healthBody?.services?.systemPrompt === true && healthBody?.services?.llm === true, JSON.stringify(healthBody?.services))
check('health 报告临时 DSH_HOME 且配置目录可写（没碰真实配置）', healthBody?.home === home && healthBody?.writable === true, `${healthBody?.home} writable=${healthBody?.writable}`)
check('health 报告首次引导尚未看过', healthBody?.onboardingSeen === false, String(healthBody?.onboardingSeen))

const summary = await call('GET', '/summary')
const summaryBody = json(summary)
check('GET /summary → 200 且带 config / roster / stats / preview', summary.status === 200 && summaryBody?.config?.version === 3 && Array.isArray(summaryBody?.roster?.rows) && typeof summaryBody?.preview === 'string' && typeof summaryBody?.stats === 'object')
check('名册能从宿主 llm 服务枚举出 provider 与模型', Array.isArray(summaryBody?.providers) && summaryBody.providers.length >= 1 && (summaryBody?.roster?.rows ?? []).length >= 2, `providers=${summaryBody?.providers?.length} rows=${summaryBody?.roster?.rows?.length}`)

const askText = sections[0].text()
check('默认（询问模式）策略含分工原则与编号连续的派活规则', askText.includes('分工原则') && askText.includes('派活规则') && askText.includes('简单、机械、自包含') && (() => {
  const numbers = [...askText.matchAll(/^(\d+)\. /gm)].map(match => Number(match[1]))
  return numbers.length >= 6 && numbers.every((value, index) => value === index + 1)
})(), '规则编号不连续或缺少分工句子')

check('默认策略带「动工前预估」与「卡住就换人」两块（v3）', askText.includes('动工前预估（每次动工先做这一步') && askText.includes('三问：这份活能拆成几块互不依赖的独立材料吗') && askText.includes('卡住就换人（本轮要求）') && askText.includes('你已经推进/等待了 6 步'), askText.slice(askText.indexOf('动工前预估'), askText.indexOf('卡住就换人')))

const armedKey = 'our-free-model:nemotron-3-ultra-free'
const saved = await call('POST', '/config', {
  body: {
    patch: {
      mode: 'auto',
      enabled: true,
      discover: { llm: true, siblings: true },
      channels: { workflow: true, subagent: true, experts: false, teams: false },
      helpers: {
        [armedKey]: { enabled: true, label: '冒烟主力' },
        'our-free-model:ling-3.0-flash-fin-free': { enabled: false },
        'our-free-model:muse-spark-1.3-contributor-free': { enabled: true },
        'fake-provider:custom-model': { enabled: true },
      },
      primary: armedKey,
      maxHelpers: 3,
      minSteps: 5,
      longTaskOnly: true,
      notes: '冒烟测试备注',
    },
  },
})
const savedBody = json(saved)
check('POST /config → 200 且写盘无错', saved.status === 200 && savedBody !== undefined && !savedBody.writeError, `status=${saved.status} writeError=${savedBody?.writeError}`)

const autoText = sections[0].text()
check('保存后策略立刻变成自动模式（无需重启）', autoText.includes('模式：自动') && autoText.includes('自动模式：满足上面的条件就直接派'), autoText.slice(0, 60))
check('策略只列已勾选的帮手：取消勾选的行消失，新勾选的行出现', autoText.includes(`- ${armedKey}（`) && !autoText.includes('our-free-model:ling-3.0-flash-fin-free') && autoText.includes('our-free-model:muse-spark-1.3-contributor-free'), autoText.slice(autoText.indexOf('勾选可用的帮手模型'), autoText.indexOf('派活规则')))
check('并发上限 / 步数门槛 / 附加要求 / 默认主力都写进策略', autoText.includes('最多同时派 3 个帮手') && autoText.includes('超过 5 步') && autoText.includes('冒烟测试备注') && autoText.includes('★默认'))
check('勾了但地区受限的帮手会被明确警示', autoText.includes('地区受限') && autoText.includes('标了地区受限/不可用的别用'))
check('未勾选的通道被明确禁止', autoText.includes('Agency 专家本轮未授权') && autoText.includes('Agent Teams 本轮未授权'))
check('卡住就换人写清了观察 / 改派 / 兜底口径', autoText.includes('list_agents 看它是否还在动') && autoText.includes('interrupt_agent 掐掉卡住的') && autoText.includes('同一个活最多改派 1 次') && autoText.includes('你（主 agent）自己接手做完，不要再外派'))
check('未勾 Agent Teams 时预估段不给建队', autoText.includes('本轮 Agent Teams 未授权，不要建队'))

const configPath = path.join(home, 'agent-dispatch', 'config.json')
const onDisk = JSON.parse(fs.readFileSync(configPath, 'utf8'))
check('配置落盘到 $DSH_HOME/agent-dispatch/config.json（v3 形状）', onDisk.version === 3 && onDisk.helpers[armedKey]?.enabled === true && onDisk.maxHelpers === 3, JSON.stringify({ version: onDisk.version, maxHelpers: onDisk.maxHelpers }))
check('v3 缺省会把 plan / failover 一并落盘', onDisk.plan?.enabled === true && onDisk.plan?.minBlocks === 2 && onDisk.plan?.autoTeam === true && onDisk.failover?.enabled === true && onDisk.failover?.waitSteps === 6 && onDisk.failover?.maxRetry === 1 && onDisk.failover?.fallback === 'main', JSON.stringify({ plan: onDisk.plan, failover: onDisk.failover }))

// ── v3 controls: the pre-flight estimate may lift the teams ban; failover is tunable ──
const tuned = await call('POST', '/config', {
  body: {
    patch: {
      channels: { workflow: true, subagent: true, experts: false, teams: true },
      plan: { enabled: true, minBlocks: 3, autoTeam: true },
      failover: { enabled: true, waitSteps: 12, maxRetry: 2, fallback: 'our-free-model:muse-spark-1.3-contributor-free' },
    },
  },
})
const tunedText = sections[0].text()
check('勾上 Agent Teams 且预估通过 → 策略允许直接建队', tuned.status === 200 && tunedText.includes('直接调用 agent_teams_create 建队') && !tunedText.includes('Agent Teams 本轮未授权'), tunedText.slice(0, 60))
check('建队门槛与兜底对象按面板取值写进策略', tunedText.includes('拆出 ≥ 3 块互不依赖') && tunedText.includes('你已经推进/等待了 12 步') && tunedText.includes('同一个活最多改派 2 次') && tunedText.includes('交给 our-free-model:muse-spark-1.3-contributor-free 收尾'))
check('勾上 teams 后观察 / 改派改用 Agent Teams 工具', tunedText.includes('agent_teams_status 看任务板和成员状态') && tunedText.includes('agent_teams_reassign_task'))

const tunedSummary = json(await call('GET', '/summary'))
const teamsChannel = (tunedSummary?.channels ?? []).find(channel => channel.id === 'teams')
check('/summary 的 teams hint 随「预估通过就直接建队」切换', teamsChannel !== undefined && teamsChannel.hint.includes('直接建队'), JSON.stringify(teamsChannel))
check('/summary 把 plan / failover 交给面板', tunedSummary?.config?.plan?.minBlocks === 3 && tunedSummary?.config?.failover?.waitSteps === 12 && tunedSummary?.config?.failover?.maxRetry === 2 && tunedSummary?.config?.failover?.fallback === 'our-free-model:muse-spark-1.3-contributor-free')

const off = await call('POST', '/config', { body: { patch: { mode: 'off' } } })
const offText = sections[0].text()
check('mode=off 时策略变成明确禁止派活', off.status === 200 && offText.includes('关闭') && offText.includes('不派活') && !offText.includes('派活规则'), offText.slice(0, 70))
check('mode=off 连预估与改派两块一起收掉', !offText.includes('动工前预估') && !offText.includes('卡住就换人'))

const missing = await call('GET', '/nope')
check('未知路由 → 404', missing.status === 404 && json(missing)?.error === 'not found', `status=${missing.status}`)

const remote = await call('GET', '/health', { host: '192.168.1.10:3080' })
check('非 loopback 的 Host → 403（面板 API 只认本机）', remote.status === 403 && json(remote)?.error === 'forbidden', `status=${remote.status}`)

const badBody = await call('POST', '/config', { raw: '{ this is not json' })
check('畸形请求体 → 500 且不崩（错误被兜住）', badBody.status === 500 && typeof json(badBody)?.error === 'string', `status=${badBody.status}`)

const guided = await call('POST', '/config', { body: { patch: { onboarding: { seen: true } } } })
const guidedHealth = json(await call('GET', '/health'))
check('POST /config 能记下「引导已看过」', guided.status === 200 && guidedHealth?.onboardingSeen === true, `status=${guided.status} seen=${guidedHealth?.onboardingSeen}`)

const reset = await call('POST', '/reset')
const resetBody = json(reset)
const resetText = sections[0].text()
check('POST /reset → 回到出厂默认（真替换：手填的帮手键也被清掉）', reset.status === 200 && resetBody?.config?.mode === 'ask' && resetBody?.config?.maxHelpers === 4 && resetBody?.config?.helpers?.['fake-provider:custom-model'] === undefined && resetText.includes('模式：询问'), JSON.stringify({ mode: resetBody?.config?.mode, maxHelpers: resetBody?.config?.maxHelpers, extraKey: resetBody?.config?.helpers?.['fake-provider:custom-model'] }))
const resetDisk = JSON.parse(fs.readFileSync(configPath, 'utf8'))
check('落盘的默认配置同样不含手填键，且默认勾选数回到出厂值', resetDisk.helpers['fake-provider:custom-model'] === undefined && Object.values(resetDisk.helpers).filter(item => item?.enabled === true).length === 6, `armedOnDisk=${Object.values(resetDisk.helpers).filter(item => item?.enabled === true).length}`)
check('POST /reset 也把 plan / failover 恢复出厂（含被调过的门槛与兜底）', resetBody?.config?.plan?.minBlocks === 2 && resetBody?.config?.plan?.autoTeam === true && resetBody?.config?.failover?.waitSteps === 6 && resetBody?.config?.failover?.maxRetry === 1 && resetBody?.config?.failover?.fallback === 'main', JSON.stringify({ plan: resetBody?.config?.plan, failover: resetBody?.config?.failover }))

let disposeOk = true
let disposeError = ''
try { for (const disposer of disposers) disposer() } catch (error) { disposeOk = false; disposeError = String(error?.message ?? error) }
check('所有 disposer 都能安全执行（插件可热卸载）', disposeOk, disposeError)

fs.rmSync(home, { recursive: true, force: true })

const failed = results.filter(item => item.ok !== true)
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed（宿主半身冒烟）`)
if (failed.length > 0) process.exitCode = 1
