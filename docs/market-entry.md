# 上架 DSH 插件市场指南

市场站点（dshmarket）**自己不收条目**：它的列表来自精选仓库 [`awesome-dsh-plugin/awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，站点每次打开实时请求 `https://awesome-dsh-plugin.com/plugins.json`。

## 一、提交方式（已在线核对，2026-09-28）

精选仓库的 README **是生成物，不能手改**。提 PR 只需要**新增一个文件**：

```
data/plugins/<owner>__<repo>.yml
```

本插件对应的文件名与内容都已经写好了，直接复制：

- 文件：`docs/awesome-dsh-plugin/Napstablooky233__dsh-agent-dispatch.yml`
- 内容：

```yaml
url: https://github.com/Napstablooky233/dsh-agent-dispatch
name: Napstablooky233/dsh-agent-dispatch
category: workflow
description:
  en: A settings panel that decides whether the main agent may delegate work and which helper agents may join, injecting that division of labour into the system prompt on every step.
  zh: 一块设置面板，决定主 agent 要不要派活、准哪几个帮手上场，并把这条分工策略注入每一步的系统提示词。
```

目标路径：`awesome-dsh-plugin/awesome-dsh-plugin` 仓库里的 `data/plugins/Napstablooky233__dsh-agent-dispatch.yml`。

## 二、硬性要求（缺一不可）

| 要求 | 本插件状态 |
| --- | --- |
| 仓库根 `package.json` 声明 `dsh.bundle`（`dsh.client` 单独声明**不算**可安装） | ✅ `dsh.bundle.patch: ./cordis.patch.yml`，且仓库根有 `cordis.patch.yml` |
| 仓库存在至少 **1 天** | ⏳ 首次 push 后满一天才能过 CI |
| 仓库带 `dsh-plugin` topic | ⏳ push 后在 GitHub 仓库设置里加（或 API 加） |
| `category` 取值来自官方集合 | ✅ `workflow`（可选值：agi ui usage theme model identity session memory tools wsl browser vision voice docs skill workflow git notify dev security remote market fun） |
| yml 里**不要**写 `npm:` 字段 | ✅ 没写——写了会被校验直接拒 |

## 三、npm 发布是**可选**的

官方 contributing.md 明确：**发不发布 npm 都不影响收录**，插件照样能从 GitHub 安装（`dsh plugin add`）。不发 npm 时想要更好的安装体验，可以把预构建 tarball 挂在 GitHub Release 上并在 yml 里用可选的 `tarball:` 字段指向它。

本插件是纯 JS、无构建步骤，从源码安装即可，**不需要** npm 发布。npm 上 `dsh-agent-dispatch` 这个名字当前是空的（2026-09-28 查 registry 返回 404），想发也能发，只是与本插件上架无关。

## 四、市场条目长什么样（观察到的真实结构）

`https://awesome-dsh-plugin.com/plugins.json`（2026-09-28 实测：`count = 4377`）里每条记录的真实字段：

```json
{
  "name": "dsh-j-space",
  "owner": "AnonyJcy",
  "url": "https://github.com/AnonyJcy/dsh-j-space",
  "page": "https://awesome-dsh-plugin.com/p/AnonyJcy/dsh-j-space/",
  "category": "agi",
  "description": { "en": "...", "zh": "..." },
  "npm": "@anonyjcy/dsh-j-space",
  "version": "1.1.2",
  "stars": 2,
  "downloads": 591,
  "capabilities": ["fs-write", "fs-read", "env"],
  "install": "dsh plugin --profile web add @anonyjcy/dsh-j-space",
  "added": "2026-09-20"
}
```

`owner` / `page` / `stars` / `downloads` / `capabilities` / `install` / `added` 都是 CI 自动采集的，投稿时**不需要**写。

## 五、PR 之后

1. CI 校验条目形状（manifest、仓库年龄、格式、README 能否重新生成）——绿了只是**前提**，不是决定。
2. 维护者会读一遍目标仓库，合并后 `main` 上自动重新生成两份 README，站点与市场随之收录。
3. 收录**不等于**安全审查。
