# dsh-agent-dispatch · 帮手调度台

一个 DSH 插件：在设置页给出一块面板，决定主 agent 要不要别的 agent 帮忙、准哪几个帮手上场，并且**真的生效**——策略以 `systemPrompt` 段的形式注入每一步，保存即生效。

- **看得见**：一个设置分区，显示状态、通道、帮手名册（含实测首字延迟）。
- **点得动**：总开关 / 三态模式 / 通道勾选 / 帮手勾选 / 并发上限 / 附加要求，改完点保存。
- **真的生效**：策略文本是函数，每步重新求值；关掉时注入「本轮不派活」的明确指令。

## 它解决什么，为什么省 token

主 agent 每推进一步都要重发完整上下文（系统提示 + 历史），按 `cacheMiss` 计费，是 token 账单的大头。独立的帮手各有独立上下文，且免费车道输入输出零成本。所以省钱的关键不是「少说话」，而是**把自包含的活挪出去**。这个插件管的就是「挪哪些、挪给谁、挪几个」。

分工原则（写死在注入文本里）：简单、机械、自包含、不依赖主会话上下文的活（批量检索、逐项审计、抄改重排、列清单、翻译、格式化、初稿）派给免费帮手；最难、最需要判断、后果在意的部分（架构与关键设计、跨模块推理、正确性与安全判断、分歧裁决、最终交付）留在主 agent。

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

六个区块，从上到下：

| 区块 | 内容 |
| --- | --- |
| 总开关与三态模式 | 开启/关闭；模式三种：关闭 / 先问我 / 直接派 |
| 帮手通道 | workflow 扇出 / 子代理单派 / Agency 专家 / Agent Teams；没勾的通道写进禁止清单 |
| 帮手名册 | 三层来源合并（宿主实注册 / 车道实测 / 手填 + 内置参考），每行标来源；★ 是默认主力 |
| 派活规模 | 同时最多几个帮手（1–8）、任务超过多少步才值得派、短任务是否禁止外派 |
| 附加要求 | 原样写进注入文本 |
| 查看注入文本 | 展开就是**真正**发给 agent 的策略，不是示意图 |

顶部另有**首次引导**（四步，看过一次不再出现）与**宿主适配自检**（解释每个功能为什么在或不在）。

## 配置键表

落盘于 `$DSH_HOME/agent-dispatch/config.json`（默认 `C:\Users\qq167\.dsh\agent-dispatch\config.json`），原子写（tmp + rename）。面板每次打开重新读取，手改此文件与面板改等价。

| 键 | 类型 | 默认 | 作用 |
| --- | --- | --- | --- |
| `version` | number | 2 | 配置结构版本；v1 的裸模型键加载时自动补 provider 前缀 |
| `enabled` | boolean | `true` | 总开关；关 = 注入「不派活」明确指令 |
| `mode` | `'off' \| 'ask' \| 'auto'` | `'ask'` | 派活模式 |
| `peer` | string | `'our-free-model'` | 名册默认 provider 名（只决定参考名册挂在谁名下，不要求这台机器真有它） |
| `discover.llm` | boolean | `true` | 是否问宿主 llm 服务枚举 provider/model |
| `discover.siblings` | boolean | `true` | 是否扫 `$DSH_HOME` 下兄弟插件的状态文件 |
| `channels.workflow` | boolean | `true` | 允许 workflow 扇出 |
| `channels.subagent` | boolean | `true` | 允许子代理单派 |
| `channels.experts` | boolean | `false` | 允许 Agency 专家 |
| `channels.teams` | boolean | `false` | 允许 Agent Teams |
| `helpers.\{provider}:{model}` | object | 见下 | 键为 `provider:model`，值 `{ enabled: boolean, label?: string }` |
| `primary` | string | `'our-free-model:nemotron-3-ultra-free'` | 默认主力帮手；必须是已勾选的模型，否则退回第一个已勾选 |
| `maxHelpers` | number | 4 | 同时最多派几个（夹回 1–8） |
| `minSteps` | number | 3 | 任务超过多少步才值得派（夹回 1–20） |
| `longTaskOnly` | boolean | `true` | 打开后一句话能答完的活不许派 |
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
| `teams` | Agent Teams 团队 | 多成员共享任务板协作（只有用户明确要求才建队） |

### 名册三层来源

每一行都有来源标签，面板显示为「车道实测 / 宿主已注册 / 手填 / 内置参考」：

1. **宿主 llm 服务实枚举**（来源 `llm`，标签「宿主已注册」）——唯一能证明「这个 provider/model 现在真的能调」的来源。
2. **兄弟插件状态文件**（来源 `peer`，标签「车道实测」）——扫 `$DSH_HOME/<任意插件目录>/catalog.json` + `availability.json`，不写死名字，拿到实测首字延迟。
3. **面板手填**（来源 `manual`，标签「手填」）——用户可填任意 `provider:model`，哪怕别的付费车道。
4. **内置参考名册**（来源 `seed`，标签「内置参考」）——11 行 `our-free-model` 模型快照，保证面板第一次打开不空。**不是事实来源**，只是「长什么样」。

合并优先级：`llm 枚举 → verified=true`；`兄弟插件 availability → state / ttftMs`；`内置参考 → 只补长什么样`，不覆盖上面两者的判定。

## HTTP API

全部走同源路由 `/api/agent-dispatch/*`，与 Host 半身在同一进程。**只服务本机浏览器，非 loopback 一律 403。**

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
- 无 `llm`：名册只剩车道实测 + 内置参考 + 手填；手填一条 provider:model 仍然可用。
- 无任何服务：面板照常可用（纯内存配置 + 内置参考名册）。

写盘失败不致命：配置先改内存并立刻生效，面板提示「写盘失败，重启后回旧值」。

## 卸载

`node scripts/install-into-profile.mjs --revert`（恢复备份），然后 `pnpm install` + 重启 dsh。
`$DSH_HOME/agent-dispatch/` 可留可删。

## 开发与自测

```powershell
node --check index.js                    # 语法检查 Host 半身
node --check client.js                   # 语法检查浏览器半身
node scripts/check-i18n.mjs              # zh/en 字典同键、且代码里 t() 引用的键都在字典里
node scripts/selftest.mjs                # 纯函数自检（策略渲染 / 配置收敛 / 名册构建），71 项
node scripts/smoke-host.mjs              # 假 cordis ctx 下跑真实 apply()，含 403、落盘、即时生效，26 项
```

`selftest.mjs` 在临时目录造假伙伴状态，验证名册优先级、地区受限与不可用降级、配置收敛（0 并发、非法 peer、非法键名都夹回安全值）。`smoke-host.mjs` 用假 `webServer` / `systemPrompt` 服务跑真实 `apply()`，确认路由挂上、配置落盘、段文本是函数（所以「保存后下一步生效」是结构事实），覆盖非 loopback 403、坏 JSON 500、disposer 可调用。

`npm run check`（语法）、`npm run test`（自检）、`npm run verify`（三项全跑）已配在 `package.json` 的 scripts 里。

## 许可

MIT。仓库：[github.com/Napstablooky/dsh-agent-dispatch](https://github.com/Napstablooky/dsh-agent-dispatch)。
