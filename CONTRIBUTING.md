# 贡献指南 · Contributing

> 本文件是**提交信息、分支与文档**的统一约定。所有术语以 [docs/GLOSSARY.md](docs/GLOSSARY.md) 为准。
> English version: [Contributing in English](#contributing-in-english).

## 提交信息规范

格式：

```
<type>(<scope>): <subject>

<body>
```

`type` 只取下面这些，不新增：

| type | 用于 |
| --- | --- |
| `feat` | 新功能 |
| `fix` | 修 bug |
| `docs` | 只改文档 |
| `test` | 只改自测/冒烟脚本 |
| `refactor` | 不改行为的重构 |
| `perf` | 性能 |
| `build` | 构建、依赖、打包 |
| `ci` | CI 配置 |
| `chore` | 杂项（仓库地址、元数据、格式） |
| `revert` | 回滚 |

- **scope 可省略**。本仓库常用：`host`（`index.js`）、`client`（`client.js`）、`i18n`、`config`、`scripts`、`docs`、`market`。
- **subject** 一句话说清「做了什么」，动词开头（中文用「加 / 修 / 换 / 补 / 删」这类动词），≤ 50 个字符，**结尾不加句号**。
- **提交信息里不写账号名、ID、邮箱**。这条是硬规矩：作者信息由 git 的 author 字段承载，在提交信息里再写一遍是噪音。
- **body** 解释「为什么」，不是「做了什么」；每行 ≤ 72 字符；多条用 `-` 列表。可以不写 body。
- **破坏性变更**：type 后加 `!`（`feat(host)!: ...`），或在 body 里写 `BREAKING CHANGE:` 起头的一段。
- **语言**：subject 用中文或英文都行，但一个仓库里保持一致——本仓库用「英文 type 前缀 + 中文 subject」。
- 例子：

```
fix(config): 修掉 /reset 的合并语义

/reset 之前走 sanitize(DEFAULT, current)，用户手填的帮手键会残留。
改为 sanitize(DEFAULT, DEFAULT)，变成真替换。
```

## 分支与提交流程

1. 从 `main` 切分支，命名 `<type>/<短主题>`：`docs/glossary`、`fix/reset-merge`。
2. 改完必须 `npm run verify` 全绿才能提交。
3. 一个提交只做一件事；无关的格式化不要混进同一个提交。
4. 开 PR 时：标题用提交信息的格式，描述里写清「为什么改」与「怎么验的」。
5. 维护者本人只对文档类小改直接推 `main`；其余一律走 PR。

## 文档约定

- 术语以 [docs/GLOSSARY.md](docs/GLOSSARY.md) 为唯一口径；**新概念先加进术语表，再写进文档**。
- 双语 README 是**镜像**：`README.md`（中文）与 `README.en.md`（English）——改一份必须在**同一个提交**里同步另一份。
- 顶部语言切换条不要动：中文页是 `zh-on.svg` + `en-off.svg`，英文页是 `en-on.svg` + `zh-off.svg`（图片都在 `docs/assets/lang/`）。
- 中英混排：中文与英文、数字之间加一个半角空格；中文用全角标点，英文用半角标点。
- 代码标识符（`provider:model`、`systemPrompt`、`$DSH_HOME`、`npm run verify`）一律加反引号并保持原样。
- 能用表格就不用长段落；示意图放 `docs/assets/`。

## 界面文案（i18n）

- 文案写在 `client.js` 的 `DICT` 对象里，`zh` 与 `en` **必须同键**——`npm run i18n` 会查「字典同键」与「代码里 `t()` 引用的键都在字典里」。
- 新增 key 用「区块.用途」式命名：`mode.ask`、`srcPeer`、`adaptLlmHint`。
- 改完文案必须跑 `npm run i18n` 与 `npm run smoke:client`：前者查键，后者真渲染面板（`node --check` 抓不到「一开就是空白」这类崩法）。

## 自测清单

```powershell
npm run verify
```

等价于 `check`（两半身语法）→ `i18n`（字典）→ `links`（Markdown 相对链接与图片）→ `test`（纯函数自检）→ `smoke`（宿主半身冒烟）→ `smoke:client`（浏览器半身冒烟）。**任何一项红都不算完成。**

## 报告问题

- 用 GitHub Issues：标题一句话说清现象，正文附上 DSH 版本、插件版本（`package.json` 的 `version`）、`$DSH_HOME/agent-dispatch/config.json` 里相关的那几行，以及面板截图。
- 面板空白或功能不见了：先看面板底部的**宿主适配自检**，它已经写明缺的是哪个服务。

## Contributing in English

Short version of the rules above:

- Commits follow Conventional Commits — `<type>(<scope>): <subject>`. Allowed types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`, `revert`.
- **Never put an account name, ID or email inside a commit message.** The author field already carries it.
- One commit does one thing. Run `npm run verify` before opening a PR; all five checks must pass.
- Branch names look like `docs/glossary` or `fix/reset-merge`.
- Terminology is governed by [docs/GLOSSARY.md](docs/GLOSSARY.md) — add a term there before using it in docs.
- `README.md` (Chinese) and `README.en.md` (English) are mirrors: update both in the same commit, and leave the language switcher at the top alone.
- UI strings live in the `DICT` object in `client.js`; `zh` and `en` must share the same keys, enforced by `npm run i18n`.
- Issues: include your DSH version, the plugin version, the relevant lines of `$DSH_HOME/agent-dispatch/config.json`, and check the host adaptation panel at the bottom of the settings section first.
