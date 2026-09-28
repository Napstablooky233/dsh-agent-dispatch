# Contributing

Unified conventions for commit messages, branches, and documentation in this repository. Terminology is governed by [`docs/GLOSSARY.md`](docs/GLOSSARY.md).

The plugin is pure JavaScript with ESM modules, has no build step and no runtime dependencies, and requires Node `^22.19.0 || >=24.0.0`. Its behaviour lives in two halves: the host half in `index.js` and the browser half in `client.js`.

## Commit messages

The format is:

```
<type>(<scope>): <subject>

<body>
```

`type` takes one of the values below and nothing else.

| type | Use for |
| --- | --- |
| `feat` | New behaviour |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Self-test and smoke scripts only |
| `refactor` | Rewrite with no behaviour change |
| `perf` | Performance |
| `build` | Build, dependencies, packaging |
| `ci` | CI configuration |
| `chore` | Repository metadata, formatting, odds and ends |
| `revert` | Revert |

`scope` is optional. In use in this repository: `host` for `index.js`, `client` for `client.js`, `i18n`, `config`, `scripts`, `docs`, `market`, `release`.

- The subject states what the commit does. It is imperative and lowercase, at most 50 characters, with no trailing period.
- The body explains why, not what. Wrap it at 72 columns. Use a `-` list for several points. The body may be omitted.
- Breaking changes carry `!` after the type (`feat(host)!: ...`), or a `BREAKING CHANGE:` paragraph at the start of the body.
- Never put an account name, an ID, or an email address in a commit message. Git's author field already carries it.

Example:

```
fix(config): repair merge semantics of /reset

/reset ran sanitize(DEFAULT, current), so helper keys typed by the user
survived the reset. Use sanitize(DEFAULT, DEFAULT) to make it a real
replacement.
```

## Branches and pull requests

- Branch off `main`. Name the branch `<type>/<short-topic>`, for example `docs/glossary` or `fix/reset-merge`.
- Run `npm run verify` before you commit. It must be green.
- One commit carries one concern. Unrelated formatting goes into its own commit.
- A pull request title uses the commit format. Its description says why the change is needed and how it was verified.
- A maintainer may push documentation typo fixes straight to `main`. Everything else goes through a pull request.

## Repository conventions

- `README.md` is the English primary. `README.zh-CN.md` is the Chinese mirror. Change one, change the other, in the same commit.
- The language bar at the top of both README files is fixed. Do not alter it. The badge images live in `docs/assets/lang/`.
- [`docs/GLOSSARY.md`](docs/GLOSSARY.md) is the single source of terminology. Add a new term there before you use it anywhere.
- Run `npm run links` after you touch any Markdown. It checks that every relative link and image target resolves.
- Keep host-half changes inside `index.js` and browser-half changes inside `client.js`.
- The plugin degrades gracefully. A missing host service removes one feature, not the panel. Do not remove that fallback.
- No emoji in any file.
- Prefer a table over a long paragraph. Diagrams belong in `docs/assets/`.

## i18n conventions

- Every UI string lives in the `DICT` object inside `client.js`.
- The `zh` and `en` branches must always have exactly the same keys.
- Name a new key `section.purpose`, for example `mode.ask`, `srcPeer`, `adaptLlmHint`.
- After editing, run `npm run i18n` and then `npm run smoke:client`. The first checks the keys, the second renders the panel. `node --check` cannot catch a panel that renders blank.

## Self-test checklist

```
npm run verify
```

Six checks run in order: `check` (syntax of both halves) → `i18n` (dictionary) → `links` (relative Markdown links and images) → `test` (pure function self-test) → `smoke` (host half) → `smoke:client` (browser half). A red check means the work is not finished.

## Releases

- A release is one commit titled `chore(release): vX.Y.Z`.
- That commit bumps `version` in `package.json` and adds the matching [`CHANGELOG.md`](CHANGELOG.md) entry. Nothing else goes into it.

## Reporting issues

Open an issue on GitHub. The title states the symptom in one sentence. The body includes:

- The DSH version.
- The plugin version from `version` in `package.json`.
- The host adaptation self-check block at the bottom of the panel. It already names the service that is missing.
- A screenshot of the panel, plus the relevant lines of `$DSH_HOME/agent-dispatch/config.json`.

## 中文速查

- 提交信息格式 `<type>(<scope>): <subject>`。type 只取 `feat` `fix` `docs` `test` `refactor` `perf` `build` `ci` `chore` `revert`。
- scope 可省略；本仓库常用 `host`（`index.js`）、`client`（`client.js`）、`i18n`、`config`、`scripts`、`docs`、`market`、`release`。
- subject 动词开头、小写、≤50 字符、结尾不加句号；body 写「为什么」，每行 ≤72 字符。破坏性变更加 `!` 或写 `BREAKING CHANGE:`。
- 提交信息里绝不写账号名、ID、邮箱——作者信息由 git author 承载。
- 分支 `<type>/<短主题>`，如 `docs/glossary`、`fix/reset-merge`。提交前 `npm run verify` 必须全绿；一个提交只做一件事。文档错字维护者可直接推 `main`。
- 术语唯一口径是 [docs/GLOSSARY.md](docs/GLOSSARY.md)，新概念先入表再进文档。
- `README.md`（英文）与 `README.zh-CN.md`（中文）互为镜像，改一份就在同一提交里改另一份；顶部语言切换条不要动。
- 改过任何 Markdown 就跑 `npm run links`；全文不用 emoji。
- 界面文案写在 `client.js` 的 `DICT` 对象里，`zh` 与 `en` 必须同键；改完跑 `npm run i18n` 与 `npm run smoke:client`。
- `npm run verify` = `check` → `i18n` → `links` → `test` → `smoke` → `smoke:client`，任一项红都不算完成。
- 发版是一个提交 `chore(release): vX.Y.Z`，同时改 `package.json` 的 `version` 与 [CHANGELOG.md](CHANGELOG.md) 条目。
- 报 issue 附：DSH 版本、插件版本、面板底部的宿主适配自检块。
