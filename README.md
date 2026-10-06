<div align="center">
<a href="README.zh-CN.md"><img src="docs/assets/lang/zh-off.svg" alt="Chinese (Simplified)" height="30"></a>&nbsp;&nbsp;<a href="README.md"><img src="docs/assets/lang/en-on.svg" alt="English" height="30"></a>
</div>

# dsh-agent-dispatch · Agent Dispatch

> One settings pane: decide whether the main agent gets help, which helpers play — and it **actually works**. Policy is injected as a `systemPrompt` section; save and it takes effect.

- **Visible**: one settings section showing status, channels, and helper roster (with measured TTFT).
- **Actionable**: master switch / three-mode selector / channel checkboxes / helper checkboxes / concurrency limit / extra notes — change and save.
- **Actually effective**: policy text is a function, re-evaluated every step; when disabled it injects an explicit "no dispatch this turn" instruction.
- **Self-checking**: before each run the agent answers one line — can this split into independent blocks? — and a helper that stops producing gets its work reassigned, then handed to a fallback.

## What it solves · Why it saves tokens

The main agent resends the full context (system prompt + history) every step, billed by `cacheMiss` — the biggest line on the token bill. Independent helpers each have their own context, and the free lane has zero cost for input and output. So the key to saving money isn't "talk less", it's **moving self-contained work out**. This plugin manages "what to move, to whom, how many".

Division of labor (hard-coded in injected text): simple, mechanical, self-contained work that does not depend on main-session context (bulk retrieval, item-by-item audit, copy-edit-reorder, list making, translation, formatting, first drafts) goes to free-lane helpers; the hardest, most judgment-heavy, consequence-sensitive parts (architecture and key design, cross-module reasoning, correctness and safety judgments, dispute resolution, final delivery) stay with the main agent.

## Install

Plugin directory: `D:\dsh-agent-dispatch` (this repo). Two ways:

### A. Auto-edit profile manifest (recommended)

```powershell
node scripts/install-into-profile.mjs            # dry run, prints the two lines to change
node scripts/install-into-profile.mjs --apply    # actually edit (auto-backup package.json)
node scripts/install-into-profile.mjs --revert   # restore from backup
```

The script touches only one file: `<DSH_HOME>/profiles/<profile>/package.json` in two places — the `link:` dependency in `dependencies`, and the package name in `dsh.profile.bundles`. After editing, run `pnpm install` in that profile directory (to turn the `link:` into a junction in `node_modules`) and **restart dsh** (`patchReload: "live"` handles hot reload, but not a new bundle; restart ends the current GUI session).

> Note: `pnpm install` aligns `node_modules` to the versions declared in `package.json` — if a plugin was previously updated to a higher version by the plugin manager, this step will downgrade it to the declared value. To keep the newer version: `pnpm add <pkg>@<version>` then restart.

### B. Manual

Equivalent to manually editing `C:\Users\qq167\.dsh\profiles\web\package.json` in two places:

1. In `dependencies` add:
   ```json
   "dsh-agent-dispatch": "link:D:/dsh-agent-dispatch"
   ```
2. In the `dsh.profile.bundles` array add the package name: `"dsh-agent-dispatch"`

Then `pnpm install` + restart dsh.

After install: Settings → **Agent Dispatch**.

## Panel overview

Eight sections, top to bottom:

| Section | Content |
| --- | --- |
| Master switch & three-mode selector | On / Off; three modes: Off / Ask me / Auto |
| Helper channels | workflow fan-out / single subagent / Agency experts / Agent Teams; unchecked channels go to the deny list |
| Helper roster | Three merged sources (host-registered / lane probe / manual + built-in reference), each row labeled with source; ★ marks the default primary |
| Dispatch scale | Max simultaneous helpers (1–8), step threshold for dispatch, whether short tasks are blocked from dispatch |
| Pre-flight estimate | Whether every run starts with a one-sentence estimate; the minimum independent block count that makes a team worth building; whether a passing estimate may build the Agent Teams team on the spot |
| Stall failover | How many steps without output count as stalled, how many reassignments per unit of work, and who finishes it afterwards (main agent, or a named checked helper) |
| Extra notes | Written verbatim into injected text |
| View injected text | Expand to see the **actual** policy sent to the agent, not a mockup |

Top also has **first-run guide** (four steps, shown once) and **host adaptation check** (explains why each feature is present or absent). On first run the sidebar's settings area also shows a compact **onboarding card** with its own layout: "Open settings" jumps straight here, "Not now" reads it once and done.

## Pre-flight estimate and stall failover

Two behaviours added in config v3. Both are injected as policy text — the agent reads them every step — and both are switched in the panel.

**Pre-flight estimate** (`plan`). Before starting, the agent answers one line: can this work be split into blocks that do not depend on each other, can each block be written as a self-contained prompt, and would a mistake be obvious at a glance? All three yes → worth dispatching; otherwise it does the work itself, and never splits a task apart just to be parallel. When the estimate passes and at least `plan.minBlocks` independent blocks fall out, the plugin allows building an Agent Teams team right there and turning each block into a task — but only while `channels.teams` is checked **and** `plan.autoTeam` is on. In `ask` mode it still asks the user once before building the team; with `autoTeam` off, an explicit request is always required.

**Stall failover** (`failover`). A helper that produces nothing for `failover.waitSteps` steps counts as stalled: the agent first sends it one question (long research may simply be quiet), then reassigns that block to another model or another upstream first — swapping members while keeping the same model repairs nothing, because the observed stall roots were upstream overload and a deprecated model — up to `failover.maxRetry` times, then hands it to `failover.fallback`. With Agent Teams checked, the check-and-reassign steps use `agent_teams_status` / `agent_teams_reassign_task`; otherwise `list_agents`, and `interrupt_agent` + `subagent` when the subagent channel is on. Handing over carries the confirmed constraints and whatever has already been produced; a block that was already dispatched is never dispatched twice, and waiting is never an excuse to idle.

Switching either one off does not remove the text — it replaces it with an explicit "not this turn" instruction, so the agent never improvises its own estimate or failover.

## Configuration keys

Persisted to `$DSH_HOME/agent-dispatch/config.json` (default `C:\Users\qq167\.dsh\agent-dispatch\config.json`), atomic write (tmp + rename). Panel re-reads on every open; hand-editing this file is equivalent to panel changes.

| Key | Type | Default | Purpose |
| --- | --- | --- | --- |
| `version` | number | 3 | Config structure version; v1 bare model keys get provider prefix auto-added on load, v2 files gain the `plan` / `failover` blocks |
| `enabled` | boolean | `true` | Master switch; off = injects explicit "no dispatch" instruction |
| `mode` | `'off' \| 'ask' \| 'auto'` | `'ask'` | Dispatch mode |
| `peer` | string | `'our-free-model'` | Roster default provider name (only decides which provider the reference roster sits under; does not require this machine to actually have it) |
| `discover.llm` | boolean | `true` | Whether to ask host LLM service to enumerate provider/model |
| `discover.siblings` | boolean | `true` | Whether to scan sibling plugins' status files under `$DSH_HOME` |
| `channels.workflow` | boolean | `true` | Allow workflow fan-out |
| `channels.subagent` | boolean | `true` | Allow single subagent dispatch |
| `channels.experts` | boolean | `false` | Allow Agency experts |
| `channels.teams` | boolean | `false` | Allow Agent Teams |
| `helpers.{provider}:{model}` | object | see below | Key is `provider:model`, value `{ enabled: boolean, label?: string }` |
| `primary` | string | `'our-free-model:nemotron-3-ultra-free'` | Default primary helper; must be an enabled model, otherwise falls back to first enabled |
| `maxHelpers` | number | 4 | Max simultaneous helpers (clamped to 1–8) |
| `minSteps` | number | 3 | Task must exceed this many steps to be worth dispatching (clamped to 1–20) |
| `longTaskOnly` | boolean | `true` | When on, tasks answerable in one sentence are not dispatched |
| `plan.enabled` | boolean | `true` | Whether every run starts with a one-sentence pre-flight estimate |
| `plan.minBlocks` | number | 2 | Independent blocks that make a team worth building (clamped to 2–8) |
| `plan.autoTeam` | boolean | `true` | Only counts while `channels.teams` is on: a passing estimate may build the team without a fresh request; off means an explicit request is still required |
| `failover.enabled` | boolean | `true` | Whether a stalled helper's work is reassigned instead of waited on |
| `failover.waitSteps` | number | 6 | Steps without output after which a helper counts as stalled (clamped to 1–50) |
| `failover.maxRetry` | number | 1 | Reassignments per unit of work before falling back (clamped to 0–3; `0` = never retry) |
| `failover.fallback` | string | `'main'` | Who finishes it: `'main'` (the main agent takes over) or a `provider:model` key; anything else reads as `main` |
| `onboarding.seen` | boolean | `false` | Set `true` after first-run guide viewed |
| `notes` | string | `''` | Extra notes, written verbatim into injected text (truncated to 2000 characters) |

Factory default `helpers` enables six verified-available `our-free-model` models: `nemotron-3-ultra-free`, `nemotron-3.5-lightning-free`, `space-bunny-free`, `longcat-2.5-preview-free`, `ling-3.0-flash-fin-free`, `mimo-v2.6-flash-free` (v1 config keys without provider prefix auto-prefixed with `our-free-model:`).

## Channels and roster

### Channels (`CHANNEL_IDS` order = panel order)

| id | Label | Description |
| --- | --- | --- |
| `workflow` | workflow fan-out | Run multiple independent sub-tasks side by side in one script, each can specify its own provider/model |
| `subagent` | single subagent | Delegate one whole independent task to another context, only get the result back |
| `experts` | Agency experts | Summon expert personas by domain (requires enabling in settings) |
| `teams` | Agent Teams | Multi-member shared task board collaboration (needs an explicit request, unless the pre-flight estimate passes with `plan.autoTeam` on) |

### Roster three sources

Every row has a source tag; panel displays as "lane probe / host-registered / manual / built-in":

1. **Host LLM service actual enumeration** (source `llm`, tag "host-registered") — the only source that can prove "this provider/model can actually be called right now".
2. **Sibling plugin status files** (source `peer`, tag "lane probe") — scans `$DSH_HOME/<any plugin dir>/catalog.json` + `availability.json`, no hardcoded names, gets measured TTFT.
3. **Panel manual entry** (source `manual`, tag "manual") — user can enter any `provider:model`, even other paid lanes.
4. **Built-in reference roster** (source `seed`, tag "built-in") — 11-row `our-free-model` model snapshot, ensures panel is not empty on first open. **Not a factual source**, only shows "what it looks like".

Merge priority: `llm enumeration → verified=true`; `sibling plugin availability → state / ttftMs`; `built-in reference → only fills appearance`, does not override the above two judgments.

## HTTP API

All routes under same-origin `/api/agent-dispatch/*`, co-located with host half in the same process. **Only serves local browser; non-loopback returns 403.**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/agent-dispatch/summary` | Returns current config, roster, preview policy, stats, host adaptation status |
| GET | `/api/agent-dispatch/health` | Returns service connectivity status, config path, roster source counts |
| POST | `/api/agent-dispatch/config` | Body `{ patch }` merges config and persists, returns full summary |
| POST | `/api/agent-dispatch/rescan` | Re-enumerates LLM and rebuilds roster |
| POST | `/api/agent-dispatch/reset` | Restores factory default and persists |

## Compatibility and graceful degradation

`inject = []` + nested fiber opportunistic acquisition of `webServer` / `systemPrompt` / `llm` three services. **Any one missing only loses the corresponding feature; plugin remains usable**:

- No `webServer`: panel API unavailable (browser half cannot read/write config), but `systemPrompt` section still injects.
- No `systemPrompt`: policy not injected (panel changes don't take effect), but API and roster work normally.
- No `llm`: roster only has lane probe + built-in reference + manual; manual entry of one `provider:model` still works.
- No services at all: panel still usable (pure in-memory config + built-in reference roster).

Write failure is not fatal: config updates memory first and takes effect immediately; panel shows "write failed, will revert on restart".

## Uninstall

`node scripts/install-into-profile.mjs --revert` (restore backup), then `pnpm install` + restart dsh.
`$DSH_HOME/agent-dispatch/` can stay or be deleted.

## Development and self-test

```powershell
node --check index.js                    # syntax check host half
node --check client.js                   # syntax check browser half
node scripts/check-i18n.mjs              # zh/en dictionaries same keys, and all t() keys in code exist in dictionaries
node scripts/check-links.mjs             # every relative Markdown link and image target exists in the repo
node scripts/selftest.mjs                # pure function self-test (policy render / config convergence / roster build), 131 checks
node scripts/smoke-host.mjs              # fake cordis ctx runs real apply(), includes 403, persist, instant effect, 39 checks
node scripts/smoke-client.mjs            # stub React + real /summary data, renders Panel four times, 34 checks
```

`selftest.mjs` creates fake peer states in a temp directory, verifies roster priority, region-blocked and unavailable degradation, config convergence (0 concurrency, illegal peer, illegal key names all clamped to safe values). `smoke-host.mjs` uses fake `webServer` / `systemPrompt` services to run real `apply()`, confirms routes mounted, config persists, segment text is a function (so "save then next step effective" is a structural fact), covers non-loopback 403, bad JSON 500, disposer callable — plus the whole v3 path: the estimate and failover blocks appearing in the injected text, the teams ban lifting once the estimate passes, and both blocks surviving `/reset`. `smoke-client.mjs` uses mini hooks runtime as stub React, feeds Panel with **actual `/summary` from host half**, asserts render tree has roster keys, has actual injected policy text, guide card disappears after viewed, and re-renders with Agent Teams armed and the estimate / failover values tuned so both new blocks — including their disabled and locked states — are proven to render. `node --check` can't catch "opens blank" crashes, this layer catches those specifically.

`npm run check` (syntax), `npm run i18n` (dictionary consistency), `npm run links` (relative link and image check), `npm run test` (self-test), `npm run smoke` (host half), `npm run smoke:client` (browser half), `npm run verify` (all six) are configured in `package.json` scripts.

## Related documents

| File | Purpose |
| --- | --- |
| [README.zh-CN.md](README.zh-CN.md) | Chinese version (Simplified Chinese mirror) |
| [AGENTS.md](AGENTS.md) | Working notes for AI coding agents: layout, contract, checks |
| [INSTALL.md](INSTALL.md) | Install, verify and uninstall steps |
| [docs/GLOSSARY.md](docs/GLOSSARY.md) | Glossary: single terminology source for all docs and UI strings in this repo |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Contributing guide: commit message format, branch flow, doc conventions |
| [SECURITY.md](SECURITY.md) | Security policy and how to report a vulnerability |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community code of conduct |
| [CHANGELOG.md](CHANGELOG.md) | Version change log |
| [docs/market-entry.md](docs/market-entry.md) | DSH plugin market entry and inclusion rules |
| [docs/publish.md](docs/publish.md) | Release process (including steps requiring manual authorization) |

## License

MIT. Repository: [github.com/Napstablooky233/dsh-agent-dispatch](https://github.com/Napstablooky233/dsh-agent-dispatch).
Chinese version: [README.zh-CN.md](README.zh-CN.md).