# dsh-agent-dispatch · Agent Dispatch

A DSH plugin: a settings panel that decides whether the main agent should delegate to other agents, which helpers may take the work, and turns that policy into a `systemPrompt` section that re-evaluates on every step.

- **Visible**: one settings section showing status, channels, helper roster with measured TTFT.
- **Actionable**: master switch / three-mode selector / channel toggles / helper toggles / concurrency limit / extra notes — save applies.
- **Live**: the policy text is a function re-evaluated each step; off mode injects an explicit "no delegation this round" instruction.

## What it solves, why it saves tokens

The main agent (paid lane) re-sends the full context at every step and bills by `cacheMiss`. Helpers have independent free contexts with zero input/output cost. So the savings don't come from saying less — they come from **moving self-contained work out**. This plugin manages *what moves, to whom, and how many*.

Division rule (hard-coded in the injected text): simple, mechanical, self-contained work that doesn't depend on the main session context (bulk retrieval, per-item audit, reformatting, lists, translation, formatting, drafts) goes to free helpers. The hardest, most judgment-critical parts (architecture and key design, cross-module reasoning, correctness and safety judgments, dispute arbitration, final delivery) stay with the main agent.

## Install

Plugin directory: `D:\dsh-agent-dispatch` (this repo). Two routes:

### A. Auto-edit the profile manifest (recommended)

```powershell
node scripts/install-into-profile.mjs            # dry run, prints the two lines to change
node scripts/install-into-profile.mjs --apply    # actually write (auto-backups package.json)
node scripts/install-into-profile.mjs --revert   # restore from backup
```

The script touches one file: `<DSH_HOME>/profiles/<profile>/package.json` — the `link:` dependency in `dependencies` and the package name in `dsh.profile.bundles`. After that, run `pnpm install` in the profile directory (to materialize the `link:` into a node_modules junction) and **restart dsh** (`patchReload: "live"` covers hot-patch reload but not new bundles; restarting ends the current GUI session).

> Note: `pnpm install` aligns node_modules to the declared versions in `package.json`. If a plugin was updated by the plugin manager to a higher version than the manifest declares, this step rolls it back. To keep a newer version: `pnpm add <pkg>@<version>` before restarting.

### B. Manual

Equivalent to editing `C:\Users\qq167\.dsh\profiles\web\package.json` in two places:

1. In `dependencies`, add:
   ```json
   "dsh-agent-dispatch": "link:D:/dsh-agent-dispatch"
   ```
2. In the `dsh.profile.bundles` array, add `"dsh-agent-dispatch"`.

Then `pnpm install` + restart dsh.

After install: **Settings → Agent Dispatch**.

## Panel overview

Six blocks, top to bottom:

| Block | Content |
| --- | --- |
| Master switch + three-mode | On/Off; modes: Off / Ask me / Auto |
| Helper channels | workflow fan-out / subagent single / Agency experts / Agent Teams; unchecked channels get explicit prohibition |
| Helper roster | Three merged sources (host-registered / lane-probed / manual + built-in), each row tagged; ★ = default primary |
| Dispatch budget | Max parallel helpers (1–8), minimum steps to deserve a helper, whether quick jobs are banned |
| Extra notes | Injected verbatim into the policy text |
| Preview | The actual policy text sent to the agent — not a mockup |

Plus a **first-run guide** (four steps, shown once) and a **host adaptation** check (explains why a feature is present or absent).

## Configuration keys

Persisted at `$DSH_HOME/agent-dispatch/config.json` (default `C:\Users\qq167\.dsh\agent-dispatch\config.json`), atomic write (tmp + rename). Panel re-reads on every open; hand-editing is equivalent to panel changes.

| Key | Type | Default | Purpose |
| --- | --- | --- | --- |
| `version` | number | 2 | Config schema version; v1 bare model keys get a provider prefix migrated on load |
| `enabled` | boolean | `true` | Master switch; off injects an explicit "no delegation" instruction |
| `mode` | `'off' \| 'ask' \| 'auto'` | `'ask'` | Dispatch mode |
| `peer` | string | `'our-free-model'` | Default provider name for the roster seed; only determines whose name the seed rows hang under, does not require the model to exist on this machine |
| `discover.llm` | boolean | `true` | Whether to query the host llm service for provider/model enumeration |
| `discover.siblings` | boolean | `true` | Whether to scan sibling plugin state files under `$DSH_HOME` |
| `channels.workflow` | boolean | `true` | Allow workflow fan-out |
| `channels.subagent` | boolean | `true` | Allow subagent single dispatch |
| `channels.experts` | boolean | `false` | Allow Agency experts |
| `channels.teams` | boolean | `false` | Allow Agent Teams |
| `helpers.{provider}:{model}` | object | see below | Key is `provider:model`; value `{ enabled: boolean, label?: string }` |
| `primary` | string | `'our-free-model:nemotron-3-ultra-free'` | Default primary helper; must be an enabled helper or it falls back to the first enabled one |
| `maxHelpers` | number | 4 | Max helpers dispatched at once (clamped to 1–8) |
| `minSteps` | number | 3 | Minimum steps before a job deserves a helper (clamped to 1–20) |
| `longTaskOnly` | boolean | `true` | When on, one-liner tasks must stay with the main agent |
| `onboarding.seen` | boolean | `false` | Set to `true` after the first-run guide is dismissed |
| `notes` | string | `''` | Extra instructions, injected verbatim (truncated to 2000 chars) |

Factory-default `helpers` enables six `our-free-model` models verified available on this host: `nemotron-3-ultra-free`, `nemotron-3.5-lightning-free`, `space-bunny-free`, `longcat-2.5-preview-free`, `ling-3.0-flash-fin-free`, `mimo-v2.5-free`. (v1 configs without a `provider:` prefix get `our-free-model:` prepended on load.)

## Channels and roster

### Channels (`CHANNEL_IDS` order = panel order)

| id | Label | Description |
| --- | --- | --- |
| `workflow` | workflow fan-out | Run multiple independent sub-tasks in one script, each with its own provider/model |
| `subagent` | subagent single | Drop a self-contained task into another context; only the result comes back |
| `experts` | Agency experts | Summon domain-specific expert personas (must be enabled in settings) |
| `teams` | Agent Teams | Multi-member shared task board (only created when the user explicitly asks) |

### Roster — three sources

Every row carries a source tag displayed as "lane probe" / "host-registered" / "manual" / "built-in":

1. **Host llm service enumeration** (source `llm`, tag "host-registered") — the only source proving a provider/model is *currently callable*.
2. **Sibling plugin state files** (source `peer`, tag "lane probe") — scans `$DSH_HOME/<any-plugin-dir>/catalog.json` + `availability.json`, no hardcoded names, delivers measured TTFT.
3. **Manual entries** (source `manual`, tag "manual") — user can add any `provider:model`, even a paid lane.
4. **Built-in seed roster** (source `seed`, tag "built-in") — 11 `our-free-model` model snapshots, guarantees the panel isn't empty on first open. **Not a source of truth** — just shows what's typical.

Merge priority: `llm enumeration → verified=true`; `sibling availability → state/ttftMs`; `seed → only fills in what it looks like`, never overrides the above.

## HTTP API

All under the same-origin route `/api/agent-dispatch/*`, running in the same process as the host body. **Loopback only; non-loopback gets 403.**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/agent-dispatch/summary` | Current config, roster, policy preview, stats, host adaptation |
| GET | `/api/agent-dispatch/health` | Service connection status, config path, source counts |
| POST | `/api/agent-dispatch/config` | Body `{ patch }` merges config and persists; returns full summary |
| POST | `/api/agent-dispatch/rescan` | Re-enumerate llm and rebuild roster |
| POST | `/api/agent-dispatch/reset` | Restore factory defaults and persist |

## Compatibility and graceful degradation

`inject = []` with nested fibers lazily acquiring `webServer` / `systemPrompt` / `llm`. **Any service absence removes only that feature — the panel stays fully usable**:

- No `webServer`: panel API unavailable (the browser half can't read/write config), but the `systemPrompt` section still injects.
- No `systemPrompt`: policy not injected (panel changes don't take effect), but API and roster work.
- No `llm`: roster falls back to lane probes + seed + manual; a manual provider:model entry still dispatches.
- No services at all: panel works (in-memory config + seed roster).

Write failure is non-fatal: config changes memory and takes effect immediately; the panel warns on disk failure.

## Uninstall

`node scripts/install-into-profile.mjs --revert` (restore backup), then `pnpm install` + restart dsh.
`$DSH_HOME/agent-dispatch/` can be kept or deleted.

## Development and testing

```powershell
node --check index.js                    # syntax check host body
node --check client.js                   # syntax check browser body
node scripts/check-i18n.mjs              # zh/en dicts share keys, every t() key exists
node scripts/selftest.mjs                # pure-function self-test (policy render / config convergence / roster build), 71 checks
node scripts/smoke-host.mjs              # real apply() under a fake cordis ctx, covering 403, persistence, live-effect, 26 checks
```

`selftest.mjs` creates fake peer state in a temp directory, verifying roster priority, region-blocked/unavailable degradation, and config convergence (0 concurrency, invalid peer, invalid keys all clamped to safe values). `smoke-host.mjs` runs the real `apply()` with fake `webServer` / `systemPrompt` services, confirming routes mount, config persists, the section text is a function (so "save takes effect on the next step" is a structural fact, not a claim), and covering non-loopback 403, bad JSON 500, and disposer callability.

`npm run check` (syntax), `npm run i18n` (dictionary consistency), `npm run test` (self-test), `npm run smoke`, and `npm run verify` (check + i18n + test) are wired up in `package.json` scripts.

## License

MIT. Repository: [github.com/Napstablooky/dsh-agent-dispatch](https://github.com/Napstablooky/dsh-agent-dispatch).
