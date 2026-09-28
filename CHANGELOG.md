# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-09-28

### Added

- **双语 README 的语言切换条**：两份 README 顶部各一对按钮（`docs/assets/lang/` 下四个自绘 SVG——当前语言深墨高亮、另一语言素纸描边），一次点击即切换语言；不依赖 shields.io 之类外部图床，断网照样显示。
- **`docs/GLOSSARY.md` 术语表**：中英对照 + 界面来源标签对照 + 书写规则，作为全仓库术语的唯一口径。
- **`CONTRIBUTING.md` 贡献指南**：提交信息规范（`type(scope): subject`，十种 type，禁止在提交信息里写账号名 / ID / 邮箱）、分支流程、文档与 i18n 约定。
- **`scripts/check-links.mjs`**：扫描所有 Markdown 的相对链接与图片目标是否真实存在，接进 `npm run verify`（现在是六项）。

### Changed

- 全仓库用语对齐术语表：统一「主 agent / 帮手 / 名册 / 派活 / 车道 / 宿主半身」，删掉禁用同义词（外派、名单、系统提示词、`lane-probe` 混写）。
- `client.js` 界面文案：`lane-probed` / `lane-probe` 统一为 `lane probe`；`notesPlaceholder` 的示例改为「不要派给帮手」。
- `index.js` 注释里的「名单」改为「名册」。
- 市场条目与 `docs/market-entry.md` 的描述统一为注入 `systemPrompt` 段；硬性要求表更新为真实状态（已 push、topic 已加、仓库年龄仍待满 24 小时）。

## [0.2.0] - 2026-09-28

### Added

- **首次引导卡**（`settings.onboarding`，order -40）：四步讲清「勾通道 → 勾帮手 → 定规模 → 保存即生效」，`onboarding.seen` 落盘后不再出现。
- **宿主适配自检**：面板实时显示 `webServer` / `systemPrompt` / `llm` 三个服务各自连没连上、配置路径可不可写、`$DSH_HOME` 在哪、扫到了哪些兄弟车道，以及 llm 枚举失败的原因。
- **名册三层来源 + `provider:model` 键**：宿主 llm 实枚举（来源 `llm`，标签「宿主已注册」）／兄弟插件 `catalog.json` + `availability.json`（来源 `peer`，标签「车道实测」，带实测首字延迟）／面板手填（来源 `manual`）／内置参考名册（来源 `seed`，11 行快照，只保证面板第一次打开不空）。每行显示来源与状态徽标。
- **手填帮手**：provider 输入带 `<datalist>` 提示，model 单独一行，「加入名册」带空值与重复校验；未落盘的条目也会先渲染出来。
- **`GET /api/agent-dispatch/health`**：返回服务连接状态、配置路径、名册来源计数。
- **`scripts/check-i18n.mjs`**：校验 zh/en 字典同键、无重复键，且代码里 `t()` 引用的键都在字典里。
- **`scripts/smoke-client.mjs`（浏览器半身冒烟，20 项）**：用迷你 hooks 运行时当桩 React、迷你 DOM 当宿主页，喂给面板的是**宿主半身真跑出来的 `/summary`**；断言面板渲染三遍（加载态 → 有数据态 → 引导已看过）不抛异常、根节点是 `ad_root`、渲染树里有名册的 `provider:model` 键、有**真注入策略的原文**（证明预览就是发给 agent 的那段）、引导卡看过即消失。`node --check` 抓不到「一开就是空白」这类崩法，这一层专门抓——它上线第一跑就抓出桩运行时没展开函数组件、Panel 根本没被执行的问题。
- **配置 v2 + v1 迁移**：`CONFIG_VERSION = 2`；v1 的裸模型键在加载时自动补 `our-free-model:` 前缀，`primary` 同步迁移。

### Changed

- **分工原则写进注入策略**：免费车道承担「简单、机械、自包含、不依赖主会话上下文」的活（批量检索、逐项审计、抄改重排、列清单、翻译、格式化、初稿）；主 agent 只保留最复杂、最需要判断、后果在意的部分（架构与关键设计、跨模块推理、正确性与安全判断、分歧裁决、最终交付）。
- 派活规则改由数组生成编号（共 9 条），不再手写序号。
- **不依赖任何插件**：`inject = []` + 嵌套 fiber 机会式获取 `webServer` / `systemPrompt` / `llm`，任一缺席只少对应功能，插件照常可用。
- 自检扩到 **71 项**、宿主冒烟 **26 项**、浏览器半身冒烟 **20 项**（0.1.0 时的 19 / 12 项已过时）；`npm run verify` 六项全跑。

### Fixed

- 修掉 `longTaskOnly = false` 时策略规则编号跳号（曾输出 1,2,3,5,6,7）。
- `POST /reset` 从「与当前配置合并默认值」改为**真替换**：用户手填与多加的帮手键也会被一起清掉。
- 面板补齐 `.ad_badge.unknown` 与 `.ad_status.idle` 两个缺失的样式类。
- `scripts/check-i18n.mjs` 把 `document.createElement('style')` 误判成 `t('style')` 的假阳性（正则加左边界）。

## [0.1.0] - 2026-08-25

### Added

- **宿主半身** (`index.js`)：注册 `systemPrompt` 策略段 (`agent-dispatch:policy`，order 180)，把派活规则注入每一步。
- **同源 HTTP API** (`/api/agent-dispatch/*`)：`GET /summary`、`POST /config`、`POST /reset`、`POST /rescan`；非 loopback 请求 403。
- **浏览器半身面板** (`client.js`)：手写 `window.__ModuleLoader__` 加载，设置分区可配置派活模式、通道、帮手模型、并发上限与附加要求。
- **配置原子落盘**：配置写入 `$DSH_HOME/agent-dispatch/config.json`，tmp + rename。
- **纯函数自检** (`scripts/selftest.mjs`) 与**宿主冒烟测试** (`scripts/smoke-host.mjs`)：假 cordis ctx 下跑真实 `apply()`，覆盖 403、落盘、即时生效、disposer。
- **安装脚本** (`scripts/install-into-profile.mjs`)：自动改 profile 清单（预演 / 应用 / 撤回）。
