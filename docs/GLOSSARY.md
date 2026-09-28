# 术语表 · Glossary

> 本表是仓库内**所有**文档、提交信息与界面文案的唯一术语口径。中文文档用「中文」列，英文文档用 English 列；代码标识符（键名、路径、API、provider 名）一律保持原样并加反引号，不进翻译。
> This table is the single source of truth for terminology across every document, commit message and UI string in this repository. Code identifiers — keys, paths, APIs, provider names — stay verbatim inside backticks and are never translated.

## 1. 产品与专名 · Product & proper nouns

| 中文 | English | 说明 / Notes |
| --- | --- | --- |
| DeepSeek Harness（首次出现）／DSH | DeepSeek Harness (first mention) / DSH | 产品名。首现写全称，之后用 DSH；命令行工具写 `dsh`（小写、反引号） |
| 帮手调度台 | Agent Dispatch | 插件名与文档标题；设置页里的分区名写作「帮手调度」 |
| 免费车道 | free lane | 零成本车道。不写「免费通道」 |
| 付费车道 | paid lane | 主 agent 所在的车道 |
| 宿主 | host | DSH 运行时。不写「系统」 |
| 宿主半身 / 浏览器半身 | host half / browser half | 插件的两个半边。不写 host body / browser body |
| 兄弟插件 | sibling plugin | `$DSH_HOME` 下的其它插件 |
| 团队 | team | 通道名 `teams`；「Agent Teams」是产品名，不翻译 |
| 专家 | expert | 通道名 `experts`；「Agency」是组织名，不翻译 |
| 子代理 | subagent | 通道名 `subagent`，不翻译、不写作「子 agent」 |
| workflow 扇出 | workflow fan-out | 通道名 `workflow`，不翻译 |
| 首字延迟 | TTFT (time to first token) | 首次出现给全称，之后写 TTFT |
| 系统提示段 | `systemPrompt` section | 代码标识符原样，不译作「系统提示词」 |
| 插件清单／profile 清单 | profile manifest | `profiles/<name>/package.json` |
| 打包项 | bundle | `dsh.profile.bundles` 里的一项 |

## 2. 插件域术语 · Plugin domain

| 中文 | English | 说明 / Notes |
| --- | --- | --- |
| 帮手 | helper | 被派活的免费车道 agent |
| 主 agent | main agent | 留在付费车道、做最难部分的那一个。**不写**「队长 / captain / 主任」 |
| 名册／帮手名册 | roster / helper roster | 面板里的帮手清单 |
| 通道 | channel | 派活的四条途径，面板顺序 = `CHANNEL_IDS` 顺序 |
| 派活 | dispatch | 动词。**不写**「外派 / 分发 / 调度」（面板名「帮手调度」除外） |
| 三态模式 | three-mode selector | `关闭 / 先问我 / 直接派` ↔ `Off / Ask me / Auto` |
| 并发上限 | concurrency limit | 同时最多几个帮手，夹回 1–8 |
| 步数门槛 | step threshold | 任务超过多少步才值得派，夹回 1–20 |
| 附加要求 | extra notes | 原样写进注入文本 |
| 首次引导 | first-run guide | 面板顶部四步引导，看过一次不再出现 |
| 宿主适配自检 | host adaptation check | 解释每个功能为什么在或不在 |
| 出厂默认 | factory default | 内置默认配置 |
| 实测可用 | verified available | 车道实测在册且可调 |
| 地区受限 | region-blocked | 车道因出口地区拒绝放行 |
| 暂不可用 | unavailable | 上游暂时不可用 |
| 降级 | graceful degradation | 缺服务只少对应功能，插件照常可用 |
| 落盘 | persist | 原子写配置文件。不写「写硬盘」 |
| 收敛 | convergence | 非法配置被夹回安全值 |
| 注入 | inject | 把策略写进 `systemPrompt` 段 |
| 预览 | preview | 面板里展开的**真实**注入文本 |

### 2.1 界面里的来源标签 · Source tags as rendered

| 中文 | English | 含义 / Meaning | 代码常量 |
| --- | --- | --- | --- |
| 车道实测 | lane probe | 来自兄弟插件的实测状态文件 | `srcPeer` |
| 宿主已注册 | host-registered | 来自宿主 llm 服务实枚举，唯一能证明现在真的能调 | `srcLlm` |
| 手填 | manual | 用户在面板里手动添加 | `srcManual` |
| 内置参考 | built-in | 出厂快照，**不是事实来源** | `srcSeed` |

## 3. 工程与文档约定 · Engineering & docs

| 中文 | English | 说明 / Notes |
| --- | --- | --- |
| 提交信息 | commit message | 格式见 [CONTRIBUTING.md](../CONTRIBUTING.md) |
| 贡献指南 | contributing guide | 仓库根的 `CONTRIBUTING.md` |
| 术语表 | glossary | 本文件 |
| 语言切换条 | language switcher | 两份 README 顶部的双按钮条 |
| 自检 | self-test | `scripts/selftest.mjs` |
| 冒烟测试 | smoke test | `scripts/smoke-host.mjs`、`scripts/smoke-client.mjs` |
| 语法检查 | syntax check | `node --check` |
| 派生／扇出 | fan-out | 一份脚本里并排跑多个独立子任务 |

## 4. 书写规则 · Writing rules

1. **中英混排**：中文与英文、数字之间加一个半角空格；中文用全角标点（，。、：；「」），英文用半角标点。数字与单位之间不加空格（`4 个帮手` 例外，量词前加空格）。
2. **代码标识符**：`provider:model`、`systemPrompt`、`$DSH_HOME`、`README.md`、`our-free-model` 永远保持原样并加反引号——不翻译、不换大小写、不补空格。
3. **产品名大小写**：`DSH`（产品）／`dsh`（命令）／`dsh-agent-dispatch`（包名）／`agent-dispatch`（面板 id）。
4. **通道名**一律小写代码体：`workflow`、`subagent`、`experts`、`teams`。
5. **英文文档**：标题用句子式大小写（sentence case）；列表项结尾不加句号（整句除外）；不用感叹号。
6. **禁用同义词**：主 agent 不写「队长」；宿主半身不写 host body；派活不写「外派」；名册不写「名单」。
