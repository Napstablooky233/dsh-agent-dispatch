# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.3] - 2026-09-28

### Fixed

- **The onboarding step no longer renders the settings panel.** The host mounts `settings.onboarding` inside the sidebar's settings column (~250px wide), where the panel — laid out as flex rows for the wide settings modal — collapsed: the 「派活模式」 label overlapped its segmented control, and the hint text was squeezed to one character per line and overflowed the card. That slot now contributes a compact card of its own (`.ad_ob`) with two exits — 「打开设置去配」 (`openSection('agent-dispatch')`) and 「暂时不用」 (persists `onboarding.seen`) — renders nothing while its fact is still loading, and honours `explicit` for an explicitly requested run.

### Changed

- Panel rows wrap rather than overlap in a narrow container: `.ad_row` and `.ad_sechead` wrap, and a hint sharing its row with a fixed-width control (`.ad_sub.ad_grow`) gets a 200px wrap basis, so it moves onto its own line instead of collapsing to one character per line.

## [0.2.2] - 2026-09-28

### Added

- **Community scaffolding that matches the wider DSH plugin ecosystem**: `AGENTS.md` (working notes for AI coding agents), `SECURITY.md`, `CODE_OF_CONDUCT.md`, `INSTALL.md`, `.gitattributes` (LF normalisation) and a GitHub Actions workflow that runs `npm run verify` on Node 22 and 24.

### Changed

- **English is now the primary language of the repository**: `README.md` became the English primary and `README.zh-CN.md` the Chinese mirror (replacing `README.en.md`), the language bar and every relative link were repointed, and `docs/GLOSSARY.md`, `docs/market-entry.md`, `docs/publish.md`, `CONTRIBUTING.md` plus the prose comments in `index.js`, `client.js` and `scripts/*.mjs` were translated. User-facing UI strings in `DICT` and the injected policy text keep their Chinese form, because the panel is bilingual by design.
- Both READMEs now list every repository document, and `package.json` carries the published description, the `files` allowlist and the repository metadata.

### Fixed

- `.github/workflows/verify.yml` no longer asks `actions/setup-node` to cache npm dependencies: this repository has no lockfile, so the cache step failed before any check ran.

## [0.2.1] - 2026-09-28

### Added

- **Bilingual README language switcher**: a pair of buttons at the top of each README (four hand-drawn SVGs under `docs/assets/lang/` — active language in deep ink, alternate language in light outline) that switches language on click; no dependency on external image hosts like shields.io, works offline.
- **`docs/GLOSSARY.md` terminology reference**: Chinese–English side-by-side + UI source labels + writing conventions, serving as the single source of truth for repository-wide terminology.
- **`CONTRIBUTING.md` contribution guide**: commit message conventions (`type(scope): subject`, ten types, no account name / ID / email in commit messages), branching workflow, documentation and i18n conventions.
- **`scripts/check-links.mjs`**: scans all Markdown files for relative links and image targets that actually exist, integrated into `npm run verify` (now six checks).

### Changed

- Repository-wide terminology aligned to the glossary: unified 「main agent / helper / roster / dispatch / lane / host half」, removed banned synonyms (export, manifest, system prompt, `lane-probe` mixed usage).
- `client.js` UI copy: `lane-probed` / `lane-probe` unified to `lane probe`; `notesPlaceholder` example changed to 「不要派给帮手」.
- `index.js` comment changes: 「名单」replaced with 「名册」.
- Marketplace entry and `docs/market-entry.md` description unified to inject `systemPrompt` section; hard requirement table updated to actual status (pushed, topic added, repository age still pending 24 hours).

## [0.2.0] - 2026-09-28

### Added

- **Onboarding card** (`settings.onboarding`, order -40): four steps explaining 「select channels → select helpers → set capacity → save to take effect」; hidden after `onboarding.seen` is persisted.
- **Host adaptation self-check**: panel displays real-time connection status of `webServer` / `systemPrompt` / `llm` services, whether config paths are writable, where `$DSH_HOME` is, which sibling lanes were discovered, and reasons for any `llm` enumeration failure.
- **Roster with three sources + `provider:model` keys**: host `llm` actual enumeration (source `llm`, label「宿主已注册」) / sibling plugin `catalog.json` + `availability.json` (source `peer`, label「车道实测」, with measured first-token latency) / manual panel entry (source `manual`) / built-in reference roster (source `seed`, 11-row snapshot, guarantees non-empty panel on first open). Each row shows source and status badge.
- **Manual helper entry**: provider input with `<datalist>` suggestions, model on a separate line, 「加入名册」with empty and duplicate validation; unsaved entries render immediately.
- **`GET /api/agent-dispatch/health`**: returns service connection status, config path, roster source counts.
- **`scripts/check-i18n.mjs`**: validates zh/en dictionaries have matching keys, no duplicate keys, and all `t()` references in code exist in the dictionaries.
- **`scripts/smoke-client.mjs` (browser-half smoke, 20 checks)**: uses a mini hooks runtime as a stub React and a mini DOM as the host page; feeds the panel the **real `/summary` output from the host half**; asserts the panel renders three times (loading → data loaded → onboarding seen) without throwing, root node is `ad_root`, the render tree contains roster `provider:model` keys, contains the **actual injected policy text** (proving preview matches what is sent to the agent), and the onboarding card disappears after being seen. `node --check` cannot catch 「opens to a blank screen」 crashes; this layer specifically catches them — on its first run it caught the stub runtime not expanding function components and Panel not being executed at all.
- **Config v2 + v1 migration**: `CONFIG_VERSION = 2`; v1 bare model keys automatically get `our-free-model:` prefix on load, `primary` migrated in sync.

### Changed

- **Division of labor written into the injected policy**: free lane handles 「simple, mechanical, self-contained, no dependency on main session context」 work (batch retrieval, per-item audit, copy-edit-rearrange, list-making, translation, formatting, drafting); main agent retains only the most complex, judgment-heavy, high-consequence parts (architecture and key design, cross-module reasoning, correctness and security judgment, dispute arbitration, final delivery).
- Dispatch rules now generated from an array with numbered items (9 total), no more hand-written numbering.
- **No dependency on any other plugin**: `inject = []` + nested fiber opportunistic acquisition of `webServer` / `systemPrompt` / `llm`; any missing service only disables the corresponding feature, plugin remains fully functional.
- Self-check expanded to **71 checks**, host smoke to **26 checks**, browser-half smoke to **20 checks** (the 19 / 12 checks from 0.1.0 are obsolete); `npm run verify` runs all six checks.

### Fixed

- Fixed strategy rule numbering skip when `longTaskOnly = false` (previously output 1,2,3,5,6,7).
- `POST /reset` changed from 「merge defaults with current config」 to **true replacement**: manually added helper keys are now also cleared.
- Panel added missing style classes `.ad_badge.unknown` and `.ad_status.idle`.
- `scripts/check-i18n.mjs` false positive where `document.createElement('style')` was misidentified as `t('style')` (regex now includes left boundary).

## [0.1.0] - 2026-08-25

### Added

- **Host half** (`index.js`): registers `systemPrompt` policy section (`agent-dispatch:policy`, order 180), injecting dispatch rules into every step.
- **Same-origin HTTP API** (`/api/agent-dispatch/*`): `GET /summary`, `POST /config`, `POST /reset`, `POST /rescan`; non-loopback requests get 403.
- **Browser-half panel** (`client.js`): loaded via hand-written `window.__ModuleLoader__`, settings section configurable for dispatch mode, channels, helper models, concurrency cap and extra requirements.
- **Atomic config persistence**: config written to `$DSH_HOME/agent-dispatch/config.json`, tmp + rename.
- **Pure-function self-check** (`scripts/selftest.mjs`) and **host smoke test** (`scripts/smoke-host.mjs`): runs real `apply()` under a fake cordis ctx, covering 403, persistence, immediate effect, disposer.
- **Install script** (`scripts/install-into-profile.mjs`): automatically modifies profile manifest (dry-run / apply / rollback).
