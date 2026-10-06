# Glossary

> This table is the single source of truth for terminology across every document, commit message and UI string in this repository. Code identifiers — keys, paths, APIs, provider names — stay verbatim inside backticks and are never translated.

## 1. Product & proper nouns

| Chinese (UI) | English | Notes |
| --- | --- | --- |
| DeepSeek Harness（首次出现）／DSH | DeepSeek Harness (first mention) / DSH | Product name. First occurrence writes full name, then DSH; CLI tool written as `dsh` (lowercase, backticks) |
| 帮手调度台 | Agent Dispatch (helper dispatch) | Plugin name and document title; the package is `dsh-agent-dispatch` and the settings section is written as "帮手调度" |
| 免费车道 | free lane | Zero-cost lane. Do not write "免费通道" |
| 付费车道 | paid lane | Lane where the main agent runs |
| 宿主 | host | DSH runtime. Do not write "系统" |
| 宿主半身 / 浏览器半身 | host half / browser half | The two halves of the plugin. Do not write host body / browser body |
| 兄弟插件 | sibling plugin | Other plugins under `$DSH_HOME` |
| 团队 | team | Channel name `teams`; "Agent Teams" is a product name, do not translate |
| 专家 | expert | Channel name `experts`; "Agency" is the organization name, do not translate |
| 子代理 | subagent | Channel name `subagent`, do not translate, do not write as "子 agent" |
| workflow 扇出 | workflow fan-out | Channel name `workflow`, do not translate |
| 首字延迟 | TTFT (time to first token) | First occurrence gives full name, then write TTFT |
| 系统提示段 | `systemPrompt` section | Code identifier verbatim, do not translate as "系统提示词" |
| 插件清单／profile 清单 | profile manifest | `profiles/<name>/package.json` |
| 打包项 | bundle | One item in `dsh.profile.bundles` |

## 2. Plugin domain

| Chinese (UI) | English | Notes |
| --- | --- | --- |
| 帮手 | helper | Free-lane agent that receives dispatched work |
| 主 agent | main agent | Stays in the paid lane, handles the hardest parts. **Do not write** "队长 / captain / 主任" |
| 名册／帮手名册 | roster / helper roster | Helper list shown in the panel |
| 通道 | channel | Four dispatch pathways; panel order = `CHANNEL_IDS` order |
| 派活 | dispatch | Verb. **Do not write** "外派 / 分发 / 调度" (except panel name "帮手调度") |
| 三态模式 | three-mode selector | `关闭 / 先问我 / 直接派` ↔ `Off / Ask me / Auto` |
| 并发上限 | concurrency limit | Maximum simultaneous helpers, clamped to 1–8 |
| 步数门槛 | step threshold | Minimum steps before dispatching is worthwhile, clamped to 1–20 |
| 附加要求 | extra notes | Written verbatim into the injected text |
| 首次引导 | first-run guide | Four-step guide at top of panel, shown once |
| 宿主适配自检 | host adaptation check | Explains why each capability is present or absent |
| 出厂默认 | factory default | Built-in default configuration |
| 实测可用 | verified available | Lane verified present and invokable |
| 地区受限 | region-blocked | Lane blocked by egress region |
| 暂不可用 | unavailable | Upstream temporarily unavailable |
| 降级 | graceful degradation | Missing service only removes that capability; plugin remains usable |
| 落盘 | persist | Atomic config file write. Do not write "写硬盘" |
| 收敛 | convergence | Invalid config clamped to safe values |
| 注入 | inject | Write policy into `systemPrompt` section |
| 预览 | preview | Panel-expanded **actual** injected text |
| 动工前预估 | pre-flight estimate | Config block `plan`. One-sentence estimate before every run: can this be split into blocks that do not depend on each other? |
| 互不依赖 | independent of each other | The property that makes a split worth doing. Do not write "并行" as the criterion — parallelism is the consequence, independence is the test |
| 值得建队 | worth building a team | Estimate passed **and** at least `plan.minBlocks` independent blocks fell out |
| 卡住改派 | stall failover | Config block `failover`. Reassign a helper's block after `failover.waitSteps` steps without output |
| 兜底 | fallback | `failover.fallback`: `'main'` (the main agent finishes it) or a named `provider:model` key |
| 主 agent 接手 | the main agent takes over | The `'main'` fallback. **Do not write** "兜底模型自己来干" for a specific model — the free lane decides which model answers |
| 一次没成直接走兜底 | one missed attempt goes straight to the fallback | `failover.maxRetry: 0`, meaning never retry |
| 已派出去的活绝不重复派 | an already-dispatched block is never dispatched twice | Guard against re-dispatching during a handover |

### 2.1 Source tags as rendered in the UI

| Chinese (UI) | English | Meaning | Code constant |
| --- | --- | --- | --- |
| 车道实测 | lane probe | From sibling plugin's verified status file | `srcPeer` |
| 宿主已注册 | host-registered | From host LLM service enumeration; only proof it can be invoked now | `srcLlm` |
| 手填 | manual | Added by user in the panel | `srcManual` |
| 内置参考 | built-in | Factory snapshot, **not a source of truth** | `srcSeed` |

## 3. Engineering & docs

| Chinese (UI) | English | Notes |
| --- | --- | --- |
| 提交信息 | commit message | Format per [CONTRIBUTING.md](../CONTRIBUTING.md) |
| 贡献指南 | contributing guide | `CONTRIBUTING.md` at repo root |
| 术语表 | glossary | This file |
| 语言切换条 | language switcher | Dual-button bar at top of both READMEs |
| 自检 | self-test | `scripts/selftest.mjs` |
| 冒烟测试 | smoke test | `scripts/smoke-host.mjs`, `scripts/smoke-client.mjs` |
| 语法检查 | syntax check | `node --check` |
| 派生／扇出 | fan-out | One script running multiple independent sub-tasks side by side |

## 4. Writing rules

1. **Mixed Chinese/English**: One half-width space between Chinese and English/numbers; Chinese uses full-width punctuation (，。、：；「」), English uses half-width punctuation. No space between number and unit (exception: `4 个帮手` adds space before measure word).
2. **Code identifiers**: `provider:model`, `systemPrompt`, `$DSH_HOME`, `README.md`, `our-free-model` always verbatim inside backticks — never translate, never change case, never add spaces.
3. **Product name casing**: `DSH` (product) / `dsh` (CLI) / `dsh-agent-dispatch` (package name) / `agent-dispatch` (panel id).
4. **Channel names** always lowercase code style: `workflow`, `subagent`, `experts`, `teams`.
5. **English docs**: Headings use sentence case; list items end without period (except full sentences); no exclamation marks.
6. **Banned synonyms**: main agent not "队长"; host half not host body; dispatch not "外派"; roster not "名单".

(End of file - total 117 lines)