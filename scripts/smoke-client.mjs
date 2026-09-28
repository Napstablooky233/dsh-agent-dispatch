/**
 * Browser half smoke test — no browser, no React installed, yet still runs the Panel's render body for real.
 *
 * Why this layer is needed: `node --check` only proves syntax passes, and `selftest`/`smoke-host`
 * don't execute a single byte of the browser half's 700+ lines. What users see is exactly this half —
 * if it crashes on start, the panel is blank. Here, stub React (a mini hooks runtime) + the **real**
 * /summary data produced by the host half's apply() are used to render through three states —
 * loading → data → guide seen — asserting the rendering tree contains everything it should.
 *
 * Safety: DSH_HOME points at a temporary directory, never touching the real config; no files written.
 *
 * Run: node scripts/smoke-client.mjs
 */
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const API_PREFIX = '/api/agent-dispatch'
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-dispatch-client-smoke-'))
process.env.DSH_HOME = home

const results = []
function check(name, ok, detail = '') {
  results.push({ name, ok: ok === true })
  console.log(`${ok === true ? 'ok  ' : 'FAIL'} - ${name}${ok === true || detail === '' ? '' : ` — ${detail}`}`)
}

// ── Fake host half (same shape as smoke-host.mjs): gets the **real** /summary data ───
const routes = []
const disposers = []
const webServer = { register(route) { routes.push(route); return () => {} } }
const systemPrompt = { section() { return () => {} } }
const llm = {
  listProviders() { return [{ id: 'our-free-model', name: 'Our free model' }, { id: 'deepseek', name: 'DeepSeek' }] },
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
const withEffect = scoped => ({ ...scoped, effect(fn) { const d = fn(); if (typeof d === 'function') disposers.push(d); return d } })
const hostCtx = {
  logger: { info() {}, warn() {}, error() {}, debug() {} },
  effect: withEffect({}).effect,
  inject(deps, scoped) {
    const bag = {}
    if (deps.includes('webServer')) bag.webServer = webServer
    if (deps.includes('systemPrompt')) bag.systemPrompt = systemPrompt
    if (deps.includes('llm')) bag.llm = llm
    scoped(withEffect(bag))
  },
  get(name) { return name === 'webServer' ? webServer : name === 'systemPrompt' ? systemPrompt : name === 'llm' ? llm : undefined },
}

function call(method, route, options = {}) {
  const handler = routes[0]?.handler
  if (typeof handler !== 'function') throw new Error('宿主半身没有注册路由处理器')
  return new Promise((resolve, reject) => {
    const req = new EventEmitter()
    req.method = method
    req.url = `${API_PREFIX}${route}`
    req.headers = { host: '127.0.0.1:3080' }
    req.destroy = () => {}
    const res = {
      status: 0, headers: undefined, body: '',
      writeHead(status, headers) { this.status = status; this.headers = headers },
      end(chunk) { this.body = String(chunk ?? ''); resolve({ status: this.status, headers: this.headers, body: this.body }) },
    }
    Promise.resolve(handler(req, res)).catch(reject)
    process.nextTick(() => { if (options.body !== undefined) req.emit('data', Buffer.from(JSON.stringify(options.body), 'utf8')); req.emit('end') })
  })
}

const host = await import(new URL('../index.js', import.meta.url))
host.apply(hostCtx, {})
const summary = JSON.parse((await call('GET', '/summary')).body)
check('前置：宿主半身产出真实 /summary（v2 配置 + 名册）', summary?.config?.version === 2 && Array.isArray(summary?.roster?.rows) && typeof summary?.preview === 'string', `rows=${summary?.roster?.rows?.length}`)

// ── Stub DOM ───────────────────────────────────────────────────────────────────
const styles = []
globalThis.document = {
  createElement(tag) {
    return {
      tag, attrs: {}, textContent: '', removed: false,
      setAttribute(key, value) { this.attrs[key] = value },
      remove() { this.removed = true },
    }
  },
  head: { appendChild(element) { styles.push(element) } },
}

// ── Stub React: mini hooks runtime (enough for Panel: state, effects, memo, refs) ───
let hooks = []
let hookIndex = 0
let pendingEffects = []
const flatten = (into, value) => {
  if (Array.isArray(value)) { for (const item of value) flatten(into, item); return into }
  if (value === null || value === undefined || value === false || value === true) return into
  into.push(value)
  return into
}
const React = {
  Fragment: Symbol('Fragment'),
  createElement(type, props, ...children) {
    const kids = []
    for (const child of children) flatten(kids, child)
    return { type, props: props ?? {}, children: kids }
  },
  useState(initial) {
    const index = hookIndex++
    if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial
    return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value }]
  },
  useEffect(fn) { pendingEffects.push(fn) },
  useMemo(fn) { hookIndex++; return typeof fn === 'function' ? fn() : fn },
  useCallback(fn) { hookIndex++; return fn },
  useRef(initial) { const index = hookIndex++; if (!(index in hooks)) hooks[index] = { current: initial }; return hooks[index] },
}

/** Actually "instantiate" functional components — the stub runtime also needs to recursively expand components like React does. */
function instantiate(node) {
  if (Array.isArray(node)) return node.map(instantiate)
  if (!node || typeof node !== 'object') return node
  const { type, props, children } = node
  if (typeof type === 'function') return instantiate(type({ ...props, children }))
  return { ...node, children: (children ?? []).map(instantiate) }
}

/** Render once: reset cursor → instantiate component tree → run the effects registered for this pass. */
function renderOnce(render, props) {
  hookIndex = 0
  pendingEffects = []
  const tree = instantiate(render(props))
  const cleanup = []
  for (const fn of pendingEffects) {
    const disposer = fn()
    if (typeof disposer === 'function') cleanup.push(disposer)
  }
  return { tree, cleanup }
}
const tick = () => new Promise(resolve => setTimeout(resolve, 25))

function collectText(node, out = []) {
  if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out }
  if (Array.isArray(node)) { for (const child of node) collectText(child, out); return out }
  if (!node || typeof node !== 'object') return out
  for (const value of Object.values(node.props ?? {})) {
    if (typeof value === 'string' || typeof value === 'number') out.push(String(value))
  }
  for (const child of node.children ?? []) collectText(child, out)
  return out
}
function collectClasses(node, out = []) {
  if (Array.isArray(node)) { for (const child of node) collectClasses(child, out); return out }
  if (!node || typeof node !== 'object') return out
  const className = node.props?.className
  if (typeof className === 'string') out.push(...className.split(/\s+/).filter(Boolean))
  for (const child of node.children ?? []) collectClasses(child, out)
  return out
}
function collectTypes(node, out = []) {
  if (Array.isArray(node)) { for (const child of node) collectTypes(child, out); return out }
  if (!node || typeof node !== 'object') return out
  out.push(node.type)
  for (const child of node.children ?? []) collectTypes(child, out)
  return out
}

// ── Load the browser half ───────────────────────────────────────────────────
let spec
globalThis.window = { __ModuleLoader__: { load(candidate) { spec = candidate } } }
const fetched = []
globalThis.fetch = async (url, options = {}) => {
  fetched.push({ url, method: options.method ?? 'GET' })
  if (url === `${API_PREFIX}/summary`) return { ok: true, status: 200, async text() { return JSON.stringify(summary) } }
  return { ok: false, status: 404, async text() { return JSON.stringify({ error: 'not found' }) } }
}

await import(new URL('../client.js', import.meta.url))

check('client.js 通过 ModuleLoader 注册，id 与包名一致', spec?.id === 'dsh-agent-dispatch' && typeof spec?.factory === 'function', `id=${spec?.id}`)

const dicts = {}
const registered = []
const NS = 'settings.agentDispatch'
const clientCtx = {
  effect(fn) { const d = fn(); if (typeof d === 'function') disposers.push(d); return d },
  locale: {
    bind: () => key => (dicts[NS]?.zh ?? {})[key] ?? key,
    register: (ns, dictionary) => { dicts[ns] = dictionary; return () => {} },
  },
  slots: {
    inject: (name, contribute) => { contribute(); return () => {} },
    register: (definition, render) => { registered.push({ definition, render }); return () => {} },
  },
}

const client = spec.factory(name => {
  if (name === 'react') return React
  throw new Error(`浏览器半身 require 了未预期的模块：${name}`)
})

check('client.js 导出 name / inject / apply', client.name === 'agent-dispatch' && Array.isArray(client.inject) && client.inject.join(',') === 'slots,locale' && typeof client.apply === 'function', `name=${client.name} inject=${client.inject}`)

client.apply(clientCtx)

const section = registered.find(item => item.definition.name === 'settings.section')
const onboarding = registered.find(item => item.definition.name === 'settings.onboarding')
check('贡献 settings.section（id agent-dispatch，order 40）', section?.definition?.id === 'agent-dispatch' && section?.definition?.order === 40 && typeof section?.render === 'function')
check('贡献 settings.onboarding（order -40），缺席也不致命', onboarding?.definition?.id === 'agent-dispatch' && onboarding?.definition?.order === -40 && typeof onboarding?.render === 'function')

check('注入样式表到 document.head，带 data-plugin 标记', styles.length === 1 && styles[0].attrs['data-plugin'] === 'dsh-agent-dispatch' && styles[0].textContent.length > 500, `styles=${styles.length} len=${styles[0]?.textContent?.length}`)
check('样式 disposer 可安全执行（热卸载不留残渣）', typeof section?.definition && disposers.length >= 1 && (() => { try { for (const d of disposers) d(); return true } catch { return false } })())
check('样式 disposer 真的会移除元素', styles[0].removed === true)

const dictionaries = dicts[NS]
const zhKeys = Object.keys(dictionaries?.zh ?? {})
const enKeys = Object.keys(dictionaries?.en ?? {})
check('注册 zh/en 字典且键完全相同', zhKeys.length > 60 && zhKeys.length === enKeys.length && zhKeys.every(key => key in (dictionaries?.en ?? {})), `zh=${zhKeys.length} en=${enKeys.length}`)

// ── Render three passes ─────────────────────────────────────────────────────────
const props = { t: key => (dictionaries?.zh ?? {})[key] ?? key }

let first
try { first = renderOnce(section.render, props) } catch (error) { check('第一遍渲染（加载态）不抛异常', false, String(error?.stack ?? error)) }
if (first) check('第一遍渲染（加载态）不抛异常', true)
await tick()

let second
try { second = renderOnce(section.render, props) } catch (error) { check('第二遍渲染（有数据态）不抛异常', false, String(error?.stack ?? error)) }
if (second) check('第二遍渲染（有数据态）不抛异常', true)

const text = collectText(second?.tree).join(' ')
const classes = collectClasses(second?.tree)
const types = collectTypes(second?.tree)

check('数据来自插件自己的同源路由 /api/agent-dispatch/summary', fetched.some(item => item.url === `${API_PREFIX}/summary`), JSON.stringify(fetched))
check('根节点是 ad_root', second?.tree?.props?.className === 'ad_root', String(second?.tree?.props?.className))
check('没有 undefined 元素类型（h(undefined) 一崩就是空白面板）', types.every(type => type !== undefined && type !== null), JSON.stringify(types.filter(type => type === undefined).length))
check('渲染树里出现名册里的 provider:model 键', /our-free-model:[a-z0-9.-]+free/.test(text), text.slice(0, 120))
check('渲染树里出现真实注入策略的原文（面板预览 = 真发给 agent 的那段）', text.includes(summary.preview.slice(0, 20)), `preview[:20]=${summary.preview.slice(0, 20)}`)
check('渲染树里出现面板标题与四个通道区块', text.includes(dictionaries.zh.title) && classes.includes('ad_card'), `cards=${classes.filter(c => c === 'ad_card').length}`)
check('首次引导卡在 onboardingSeen=false 时出现', classes.includes('ad_guide'))
check('没有渲染出未定义文案（t() 返回 key 本身说明漏键）', !text.includes('undefined') && !text.includes('NaN'), text.includes('undefined') ? '文本里出现 undefined' : '')

// Third pass: after the guide has been seen, the guide card should disappear
summary.health.onboardingSeen = true
renderOnce(section.render, props)
await tick()
const third = renderOnce(section.render, props)
check('onboardingSeen=true 后引导卡消失（只看一次）', !collectClasses(third.tree).includes('ad_guide'))

// ── Summary ─────────────────────────────────────────────────────────────────────
fs.rmSync(home, { recursive: true, force: true })
const failed = results.filter(item => item.ok !== true)
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed（浏览器半身冒烟）`)
if (failed.length > 0) {
  for (const item of failed) console.log(` - ${item.name}`)
  process.exit(1)
}
