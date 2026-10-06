<div align="center">
<a href="README.zh-CN.md"><img src="docs/assets/lang/zh-on.svg" alt="简体中文" height="30"></a>&nbsp;&nbsp;<a href="README.md"><img src="docs/assets/lang/en-off.svg" alt="English" height="30"></a>
</div>

# dsh-agent-dispatch · 帮手调度台

> 一块设置面板：决定主 agent 要不要别的 agent 帮忙、准哪几个帮手上场——而且**真的生效**。策略以 `systemPrompt` 段的形式注入，保存即生效。

- **看得见**：一个设置分区，显示状态、通道与帮手名册（含实测首字延迟）。
- **点得动**：总开关 / 三态模式 / 通道勾选 / 帮手勾选 / 并发上限 / 附加要求，改完点保存。
- **真的生效**：策略文本是函数，每步重新求值；关闭时注入「本轮不派活」的明确指令。
- **会自检**：每次动工前先估一句话——这活能不能拆成几块互不依赖的？帮手卡住就换人，换不动就交给兜底。

## 它解决什么 · 为什么省 token

主 agent 每推进一步都要重发完整上下文（系统提示 + 历史），按 `cacheMiss` 计费，是 token 账单的大头。独立的帮手各有独立上下文，且免费车道输入输出零成本。所以省钱的关键不是「少说话」，而是**把自包含的活挪出去**。这个插件管的就是「挪哪些、挪给谁、挪几个」。

分工原则（写死在注入文本里）：简单、机械、自包含、不依赖主会话上下文的活（批量检索、逐项审计、抄改重排、列清单、翻译、格式化、初稿）派给免费车道的帮手；最难、最需要判断、后果在意的部分（架构与关键设计、跨模块推理、正确性与安全判断、分歧裁决、最终交付）留在主 agent。

## 安装

插件目录：`D:\dsh-agent-dispatch`（本仓库）。两条路：

### A. 自动改 profile 清单（推荐）

```powershell
node scripts/install-into-profile.mjs            # 预演，打印将改的两行
node scripts/install-into-profile.mjs --apply    # 真的改（自动备份 package.json）
node scripts/install-into-profile.mjs --revert   # 撤回到备份
```

脚本只动一处文件：`<DSH_HOME>/profiles/<profile>/package.json` 的两处——`dependencies` 里的 `link:` 依赖，和 `dsh.profile.bundles` 里的包名。改完在该 profile 目录跑 `pnpm install`（让 `link:` 变成 node_modules 里的 junction）并**重启 dsh**（`patchReload: "live"` 管得了热更，管不了新增 bundle，重启会结束当前 GUI 会话）。

> 注意：`pnpm install` 会把 node_modules 对齐到 `package.json` 的声明版本——如果某个插件此前被插件管理器更新到更高版本，这一步会把它降回声明值。想保持新版：`pnpm add <包>@<版本>` 后再重启。

### B. 手动

等价于手动改 `C:\Users\qq167\.dsh\profiles\web\package.json` 两处：

1. `dependencies` 里加：
   ```json
   "dsh-agent-dispatch": "link:D:/dsh-agent-dispatch"
   ```
2. `dsh.profile.bundles` 数组里加包名：`"dsh-agent-dispatch"`

然后 `pnpm install` + 重启 dsh。

装好后：设置 → **帮手调度**。

## 面板速览

八个区块，从上到下：

| 区块 | 内容 |
| --- | --- |
| 总开关与三态模式 | 开启 / 关闭；模式三种：关闭 / 先问我 / 直接派 |
| 帮手通道 | workflow 扇出 / 子代理单派 / Agency 专家 / Agent Teams；没勾的通道写进禁止清单 |
| 帮手名册 | 三层来源合并（宿主已注册 / 车道实测 / 手填 + 内置参考），每行标来源；★ 是默认主力 |
| 派活规模 | 同时最多几个帮手（1–8）、任务超过多少步才值得派、短任务是否禁止派活 |
| 动工前预估 | 是否每次动工先估一句话；拆出几块才算值得建队；预估通过能不能当场建 Agent Teams 队 |
| 卡住改派 | 多少步没产出算卡住、同一个活最多改派几次、之后交给谁收尾（主 agent 或某个已勾选的帮手） |
| 附加要求 | 原样写进注入文本 |
| 查看注入文本 | 展开就是**真正**发给 agent 的策略，不是示意图 |

顶部另有**首次引导**（四步，看过一次不再出现）与**宿主适配自检**（解释每个功能为什么在或不在）。首次打开时，侧栏设置区还会出现一张**引导小卡片**（自带排版，不占用设置页布局）：「打开设置去配」直达本页，「暂时不用」即只看这一次。

## 动工前预估与卡住改派

配置 v3 新增的两个行为。两者都写进注入文本（agent 每步都会读到），都能在面板上开关。

**动工前预估**（`plan`）。动工之前，主 agent 先用一句话回答：这份活能不能拆成几块互不依赖的？每一块能不能写成自包含 prompt？做错能不能一眼看出来？三问都是「是」→ 值得派；否则自己干，也不为了并行而硬拆。预估通过、并且拆出至少 `plan.minBlocks` 块时，插件允许当场建一个 Agent Teams 队、把每块写成一条任务——但必须同时满足 `channels.teams` 已勾选 **且** `plan.autoTeam` 打开。询问模式下建队前仍先问用户一次；关掉 `autoTeam` 则永远要用户明确要求。

**卡住改派**（`failover`）。帮手连续 `failover.waitSteps` 步没有任何产出就算卡住：主 agent 先发一条消息问一句（长调研可能只是安静），确认没动静就把这块活改派给另一个已勾选的帮手（优先挑实测延迟更低的），最多改派 `failover.maxRetry` 次，之后交给 `failover.fallback`。勾了 Agent Teams 时，观察与改派用 `agent_teams_status` / `agent_teams_reassign_task`；否则用 `list_agents`，子代理通道开着时用 `interrupt_agent` + `subagent`。改派时把已确认的约束和已有的部分产出一并转交；已经派出去的活绝不重复派，等待期间也不许整轮空转。

任一开关关掉都不是删掉文本，而是换成一句明确的「本轮不做」指令，agent 不会自己发挥一套预估或改派。

## 配置键表

落盘于 `$DSH_HOME/agent-dispatch/config.json`（默认 `C:\Users\qq167\.dsh\agent-dispatch\config.json`），原子写（tmp + rename）。面板每次打开重新读取，手改此文件与面板改等价。

| 键 | 类型 | 默认 | 作用 |
| --- | --- | --- | --- |
| `version` | number | 3 | 配置结构版本；v1 的裸模型键加载时自动补 provider 前缀，v2 文件会补上 `plan` / `failover` 两块 |
| `enabled` | boolean | `true` | 总开关；关 = 注入「不派活」明确指令 |
| `mode` | `'off' \| 'ask' \| 'auto'` | `'ask'` | 派活模式 |
| `peer` | string | `'our-free-model'` | 名册默认 provider 名（只决定参考名册挂在谁名下，不要求这台机器真有它） |
| `discover.llm` | boolean | `true` | 是否问宿主 llm 服务枚举 provider/model |
| `discover.siblings` | boolean | `true` | 是否扫 `$DSH_HOME` 下兄弟插件的状态文件 |
| `channels.workflow` | boolean | `true` | 允许 workflow 扇出 |
| `channels.subagent` | boolean | `true` | 允许子代理单派 |
| `channels.experts` | boolean | `false` | 允许 Agency 专家 |
| `channels.teams` | boolean | `false` | 允许 Agent Teams |
| `helpers.\{provider}:{model\}` | object | 见下 | 键为 `provider:model`，值 `{ enabled: boolean, label?: string }` |
| `primary` | string | `'our-free-model:nemotron-3-ultra-free'` | 默认主力帮手；必须是已勾选的模型，否则退回第一个已勾选 |
| `maxHelpers` | number | 4 | 同时最多派几个（夹回 1–8） |
| `minSteps` | number | 3 | 任务超过多少步才值得派（夹回 1–20） |
| `longTaskOnly` | boolean | `true` | 打开后一句话能答完的活不许派 |
| `plan.enabled` | boolean | `true` | 是否每次动工前先估一句话 |
| `plan.minBlocks` | number | 2 | 拆出几块互不依赖的活才算值得建队（夹回 2–8） |
| `plan.autoTeam` | boolean | `true` | 只在 `channels.teams` 已勾选时有意义：预估通过可以直接建队、不必等用户当场再提一次；关掉则仍要用户明确要求 |
| `failover.enabled` | boolean | `true` | 帮手卡住时是否改派，而不是继续干等 |
| `failover.waitSteps` | number | 6 | 多少步没产出算卡住（夹回 1–50） |
| `failover.maxRetry` | number | 1 | 同一个活最多改派几次，用尽即走兜底（夹回 0–3；`0` = 一次不重试） |
| `failover.fallback` | string | `'main'` | 兜底谁来做：`'main'`（主 agent 自己接手）或一个 `provider:model` 键；其它值一律读作 `main` |
| `onboarding.seen` | boolean | `false` | 看过首次引导后置 `true` |
| `notes` | string | `''` | 附加要求，原样写进注入文本（截尾 2000 字符） |

出厂默认 `helpers` 勾选了六个 `our-free-model` 下的实测可用模型：`nemotron-3-ultra-free`、`nemotron-3.5-lightning-free`、`space-bunny-free`、`longcat-2.5-preview-free`、`ling-3.0-flash-fin-free`、`mimo-v2.5-free`（v1 配置无 provider 前缀的键自动补 `our-free-model:`）。

## 通道与名册

### 通道（`CHANNEL_IDS` 顺序即面板顺序）

| id | 标签 | 说明 |
| --- | --- | --- |
| `workflow` | workflow 扇出 | 一个脚本里并排跑多个独立子任务，可逐项指定 provider/model |
| `subagent` | 子代理单派 | 把一整块独立任务丢给另一个上下文，只收回结果 |
| `experts` | Agency 专家 | 按领域召唤专家人格（需在设置里已启用） |
| `teams` | Agent Teams 团队 | 多成员共享任务板协作（需用户明确要求；动工前预估通过且 `plan.autoTeam` 打开时可直接建队） |

### 名册三层来源

每一行都有来源标签，面板显示为「车道实测 / 宿主已注册 / 手填 / 内置参考」：

1. **宿主 llm 服务实枚举**（来源 `llm`，标签「宿主已注册」）——唯一能证明「这个 provider/model 现在真的能调」的来源。
2. **兄弟插件状态文件**（来源 `peer`，标签「车道实测」）——扫 `$DSH_HOME/<任意插件目录>/catalog.json` + `availability.json`，不写死名字，拿到实测首字延迟。
3. **面板手填**（来源 `manual`，标签「手填」）——用户可填任意 `provider:model`，哪怕别的付费车道。
4. **内置参考名册**（来源 `seed`，标签「内置参考」）——11 行 `our-free-model` 模型快照，保证面板第一次打开不空。**不是事实来源**，只说明「长什么样」。

合并优先级：`llm 枚举 → verified=true`；`兄弟插件 availability → state / ttftMs`；`内置参考 → 只补长什么样`，不覆盖上面两者的判定。

## HTTP API

全部走同源路由 `/api/agent-dispatch/*`，与宿主半身在同一进程。**只服务本机浏览器，非 loopback 一律 403。**

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/api/agent-dispatch/summary` | 返回当前配置、名册、预览策略、统计、宿主适配状态 |
| GET | `/api/agent-dispatch/health` | 返回服务连接状态、配置路径、名册来源计数 |
| POST | `/api/agent-dispatch/config` | body `{ patch }` 合并配置并落盘，返回完整 summary |
| POST | `/api/agent-dispatch/rescan` | 重新枚举 llm 并重建名册 |
| POST | `/api/agent-dispatch/reset` | 恢复出厂默认并落盘 |

## 兼容与降级

`inject = []` + 嵌套 fiber 机会式获取 `webServer` / `systemPrompt` / `llm` 三个服务。**任一缺席只少对应功能，插件照常可用**：

- 无 `webServer`：面板 API 不可用（浏览器半身不能读写配置），但 `systemPrompt` 段照常注入。
- 无 `systemPrompt`：策略不注入（面板改完不生效），但 API 与名册正常。
- 无 `llm`：名册只剩车道实测 + 内置参考 + 手填；手填一条 `provider:model` 仍然可用。
- 无任何服务：面板照常可用（纯内存配置 + 内置参考名册）。

写盘失败不致命：配置先改内存并立刻生效，面板提示「写盘失败，重启后回旧值」。

## 卸载

`node scripts/install-into-profile.mjs --revert`（恢复备份），然后 `pnpm install` + 重启 dsh。
`$DSH_HOME/agent-dispatch/` 可留可删。

## 开发与自测

```powershell
node --check index.js                    # 语法检查宿主半身
node --check client.js                   # 语法检查浏览器半身
node scripts/check-i18n.mjs              # zh/en 字典同键、且代码里 t() 引用的键都在字典里
node scripts/check-links.mjs             # Markdown 相对链接与图片目标是否真实存在
node scripts/selftest.mjs                # 纯函数自检（策略渲染 / 配置收敛 / 名册构建），124 项
node scripts/smoke-host.mjs              # 假 cordis ctx 下跑真实 apply()，含 403、落盘、即时生效，37 项
node scripts/smoke-client.mjs            # 桩 React + 真 /summary 数据，把 Panel 真渲染四遍，34 项
```

`selftest.mjs` 在临时目录造假伙伴状态，验证名册优先级、地区受限与暂不可用的降级、配置收敛（0 并发、非法 peer、非法键名都夹回安全值）。`smoke-host.mjs` 用假 `webServer` / `systemPrompt` 服务跑真实 `apply()`，确认路由挂上、配置落盘、段文本是函数（所以「保存后下一步生效」是结构事实），覆盖非 loopback 403、坏 JSON 500、disposer 可调用，以及 v3 全链路：预估与改派两块出现在注入文本里、预估通过后 teams 禁令解除、两块在 `/reset` 后回到出厂。`smoke-client.mjs` 用迷你 hooks 运行时当桩 React，喂给面板的是**宿主半身真跑出来的 `/summary`**，断言渲染树里有名册键、有真注入策略的原文、引导卡看过就消失，再勾上 Agent Teams 并调过预估与改派参数重渲染一遍，确认两个新区块（含禁用与锁定态）都真能渲染出来——`node --check` 抓不到「一开就是空白」这类崩法，这一层专门抓。

`npm run check`（语法）、`npm run i18n`（字典一致性）、`npm run links`（链接检查）、`npm run test`（自检）、`npm run smoke`（宿主半身）、`npm run smoke:client`（浏览器半身）、`npm run verify`（六项全跑）已配在 `package.json` 的 scripts 里。

## 相关文档

| 文件 | 用途 |
| --- | --- |
| [README.md](README.md) | 英文版（English primary） |
| [AGENTS.md](AGENTS.md) | 给 AI 编码 agent 的工作约定：结构、契约、自检 |
| [INSTALL.md](INSTALL.md) | 安装、验证与卸载步骤 |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | 术语表：本仓库所有文档与界面文案的唯一口径 |
| [CONTRIBUTING.md](CONTRIBUTING.md) | 贡献指南：提交信息规范、分支流程、文档约定 |
| [SECURITY.md](SECURITY.md) | 安全策略与漏洞报告方式 |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | 社区行为准则 |
| [CHANGELOG.md](CHANGELOG.md) | 版本变更记录 |
| [docs/market-entry.md](docs/market-entry.md) | 上架 DSH 插件市场的条目与收录规则 |
| [docs/publish.md](docs/publish.md) | 发布流程（含需要人工授权的步骤） |

## 许可

MIT。仓库：[github.com/Napstablooky233/dsh-agent-dispatch](https://github.com/Napstablooky233/dsh-agent-dispatch)。
English version: [README.md](README.md).
