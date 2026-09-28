# AGENTS.md

Working notes for AI coding agents in this repository. Read this file once, then work.

## What this repository is

`dsh-agent-dispatch` ("helper dispatch") is a plugin for DeepSeek Harness (DSH). It contributes a settings panel and an onboarding card to the DSH web GUI, plus a loopback-only HTTP API, and it injects the user's delegation policy into a `systemPrompt` section so the main agent knows whether it may hand work to helper agents and which helpers are allowed.

It is plain JavaScript with no build step and no runtime dependencies. Both halves are hand-written: the host half is `index.js`, the browser half is `client.js` and is loaded through `window.__ModuleLoader__.load({ id, factory })`, not through a bundler.

## Layout

| Path | Role |
| --- | --- |
| `index.js` | Host half: config file, roster build, HTTP API, `systemPrompt` policy section |
| `client.js` | Browser half: the settings panel, the onboarding card, the stylesheet |
| `cordis.patch.yml` | Bundle patch that registers the plugin under its id |
| `scripts/` | Six checks plus the profile install helper |
| `docs/` | Glossary, market entry notes, publish notes, language-bar SVG buttons |
| `README.md` | English primary README |
| `README.zh-CN.md` | Chinese mirror README |

## Before you edit

1. Read `docs/GLOSSARY.md`. It is the single source of terminology; a new concept enters the glossary before it enters any other document.
2. Read `CONTRIBUTING.md` for the commit message format, the branch flow and the documentation conventions.
3. Run `npm run verify` on the clean tree so you know the baseline passes.

## The contract

- `README.md` and `README.zh-CN.md` are mirrors. Change one, change the other, in the same commit.
- The language bar at the top of both README files is fixed: it is two repository-local SVG buttons, and it points at the two files by relative path.
- Every user-facing UI string lives in the `DICT` object inside `client.js`. `zh` and `en` must always have exactly the same keys.
- The injected policy text is rendered by `renderPolicy()` in `index.js`. The panel preview calls that same function, so the preview and the injected text can never disagree.
- The HTTP API stays loopback-only. Non-loopback requests must keep receiving 403.
- A missing host service is not an error: the plugin acquires `webServer`, `systemPrompt` and `llm` through nested opportunistic fibers, and each one that is absent only removes one feature. Do not turn those into hard dependencies.
- The config file is written atomically (temporary file plus rename) to `$DSH_HOME/agent-dispatch/config.json`. Keep it that way.

## Verify

`npm run verify` chains six steps and every step must be green:

1. `check` — `node --check` on both halves
2. `i18n` — `zh`/`en` dictionaries have the same keys and every `t()` key exists
3. `links` — every relative Markdown link and image target resolves
4. `test` — pure function self-tests
5. `smoke` — the real `apply()` under a fake cordis context
6. `smoke:client` — the panel rendered three times against real `/summary` data

## Do not

- Do not add npm dependencies, a bundler, a framework, or any build step.
- Do not put emoji in any file.
- Do not write an account name, ID, or email address into a commit message.
- Do not edit the copy of the market entry inside the curated `awesome-dsh-plugin` repository: that repository's README is generated, and a submission is one new YAML file.
- Do not claim a security property that no check covers.
- Do not reformat unrelated code in a commit that is about something else.
