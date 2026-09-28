# Market Entry Guide for DSH Plugins

The market site (`dshmarket`) **does not accept submissions directly**: its listings come from the curated repository [`awesome-dsh-plugin/awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin), and the site requests `https://awesome-dsh-plugin.com/plugins.json` live on every page load.

## 1. Submission method (verified online, 2026-09-28)

The curated repository's README **is a generated artifact and must not be hand-edited**. Submitting a PR requires only **adding one file**:

```
data/plugins/<owner>__<repo>.yml
```

The filename and content for this plugin have already been written. Copy them directly:

- File: `docs/awesome-dsh-plugin/Napstablooky233__dsh-agent-dispatch.yml`
- Content:

```yaml
url: https://github.com/Napstablooky233/dsh-agent-dispatch
name: Napstablooky233/dsh-agent-dispatch
category: workflow
description:
  en: A settings panel that decides whether the main agent may delegate work and which helpers may join, injecting that division of labor into the systemPrompt section on every step.
  zh: 一块设置面板，决定主 agent 要不要派活、准哪几个帮手上场，并把这条分工策略注入 systemPrompt 段，保存即生效。
```

Target path: `awesome-dsh-plugin/awesome-dsh-plugin` repository, at `data/plugins/Napstablooky233__dsh-agent-dispatch.yml`.

## 2. Hard requirements (all must be met)

| Requirement | This Plugin |
| --- | --- |
| Repository root `package.json` declares `dsh.bundle` (declaring `dsh.client` alone does **not** count as installable) | Met: `dsh.bundle.patch: ./cordis.patch.yml`, and `cordis.patch.yml` exists at the repository root |
| Repository exists for at least **1 day** | Pending: first push on 2026-09-28 (UTC); passes the age check only after 24 hours |
| Repository has the `dsh-plugin` topic | Met: added `agent` `deepseek-harness` `dsh` `dsh-plugin` `workflow` |
| `category` value comes from the official set | Met: `workflow` (options: agi ui usage theme model identity session memory tools wsl browser vision voice docs skill workflow git notify dev security remote market fun) |
| Do **not** include an `npm:` field in the yml | Met: not present — including it would be rejected by validation |

## 3. npm publishing is optional

The official `contributing.md` states: **publishing or not publishing on npm does not affect listing**; plugins can still be installed from GitHub via `dsh plugin add`. When not publishing on npm, you can attach a pre-built tarball to a GitHub Release and use the optional `tarball:` field in the yml to point to it.

This plugin is pure JS with no build step and can be installed from source. **npm publishing is not required.** The name `dsh-agent-dispatch` is currently empty on npm (checked the registry on 2026-09-28, returned 404); it can be published if desired, but it is unrelated to this plugin's listing.

## 4. What a market listing looks like (observed real structure)

Each record at `https://awesome-dsh-plugin.com/plugins.json` (2026-09-28 measurement: `count = 4377`) has these real fields:

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

`owner`, `page`, `stars`, `downloads`, `capabilities`, `install`, and `added` are all collected by CI automatically. **You do not need to write them.**

## 5. After the PR

1. CI validates the listing shape (manifest, repository age, format, whether the README can be regenerated) — turning green is only a **prerequisite**, not a decision.
2. A maintainer reviews the target repository; after merging, `main` automatically regenerates both READMEs, and the site and market pick up the listing.
3. **Listing does not equal security review.**
