/**
 * dsh-agent-dispatch —— Agent Dispatch (browser half).
 *
 * Contributes a settings section (`settings.section` id `agent-dispatch`): on this one page, decide
 *   1. Whether to let other agents help (master switch + off/ask/auto tri-state);
 *   2. Which channel to dispatch through (workflow fan-out / subagent single dispatch / Agency experts / Agent Teams);
 *   3. Which helper models may be used — the roster comes from three sources (host llm enumeration / sibling plugin
 *      probe state files / built-in reference + any manually-entered provider:model), with no dependency on any other plugin;
 *   4. How many at once, and how long a job must be to warrant dispatching;
 *   5. First-time users: a four-step onboarding guide + a "host adaptation" self-check explaining why each feature is or isn't present.
 *
 * `settings.onboarding` is a separate, compact card rather than the panel: the host mounts that slot in the
 * narrow sidebar column, and the panel's layout is built for the wide settings modal.
 *
 * Data flows only through the plugin's own same-origin HTTP routes `/api/agent-dispatch/*` — in the same process as the Host half,
 * needing no extra binding or handshake.
 *
 * Hand-written ModuleLoader bundle: no build step, no dependencies beyond the shell's built-in `react`;
 * all colors come from theme variables, so switching the color scheme won't break anything.
 */
window.__ModuleLoader__.load({
  id: 'dsh-agent-dispatch',
  factory: require => {
    const module = { exports: {} }
    const exports = module.exports
    const React = require('react')
    const { createElement: h, Fragment, useState, useEffect, useMemo, useCallback, useRef } = React

    const NS = 'settings.agentDispatch'
    const API = '/api/agent-dispatch'
    const inject = ['slots', 'locale']

    // ── Copy (zh / en must share the same keys) ───────────────────────────────────────────────
    const DICT = {
      zh: {
        nav: '帮手调度',
        title: '帮手调度台',
        subtitle: '决定主 agent 要不要人帮忙、准谁上场',
        loading: '正在读取配置…',
        loadFailed: '读不到插件后端',
        retry: '重试',
        on: '已开启',
        off: '已关闭',
        statHelpers: '可用帮手',
        statArmed: '已勾选',
        statChannels: '通道',
        statConcurrency: '并发上限',
        master: '让其他 agent 帮忙',
        masterHint: '开启后：简单、机械、自包含的活优先派给免费车道的帮手，最复杂最难、要拍板的部分留在主 agent 这里。关闭则全部自己干。',
        mode: '派活模式',
        'mode.off': '关闭',
        'mode.ask': '先问我',
        'mode.auto': '直接派',
        'modeHint.off': '整轮不派活：不扇出、不召唤、不建队。',
        'modeHint.ask': '派活前先问你一句「要不要派、派几个」。',
        'modeHint.auto': '满足条件就直接派，不再问。',
        channels: '帮手通道',
        channelsHint: '没勾的通道这轮不许用——注入文本里会明确写禁止。',
        roster: '帮手名册',
        rosterHint: '三层来源合并：宿主已注册、车道实测、手填。勾上的才是允许上场的。状态只是探测那一刻的快照：标着「可用」不代表模型没被弃用或限流，真调用失败就换模型。',
        colHelper: '帮手',
        colSource: '来源',
        colState: '状态',
        srcPeer: '车道实测',
        srcLlm: '宿主已注册',
        srcManual: '手填',
        srcSeed: '内置参考',
        srcSeedHint: '这行只是内置参考，没在宿主里核到；要用请以手填方式加一条，或确认 provider 名。',
        measuredAt: '实测于',
        never: '尚未探测',
        rescan: '重新扫描',
        rescanning: '扫描中…',
        stateAvailable: '可用',
        stateRegion: '地区受限',
        stateUnavailable: '暂不可用',
        stateThrottled: '已达限额',
        stateUnknown: '未探测',
        ttft: '首字',
        setPrimary: '设为默认',
        primary: '默认主力',
        remove: '移除',
        addTitle: '手填一个帮手（任何 provider 都行）',
        addProvider: 'provider',
        addModel: 'model',
        addBtn: '加入名册',
        addHint: '只要宿主里有这个 provider，就能派活——插件本身不要求装过任何别的插件。',
        addDup: '这条已经在名册里了。',
        addBad: 'provider 与 model 都要填。',
        scale: '派活规模',
        concurrency: '同时最多几个帮手',
        minSteps: '任务超过多少步才值得派',
        longTaskOnly: '短任务不许派',
        longTaskOnlyHint: '打开后，一句话能答完的活必须你亲自做。',
        plan: '动工前预估',
        planHint: '每次动工前先估一句话：这活能不能拆成几块互不依赖的材料、每块能不能写成自包含 prompt。估出来的结果决定派不派、要不要建队。',
        planOn: '每次动工前先估一次',
        planOnHint: '关掉后不再要求预估，直接按派活规则自行判断。',
        planMinBlocks: '至少几块才建队',
        planMinBlocksHint: '拆出这么多块互不依赖的活，才值得建队并行（2–8）。',
        planAutoTeam: '预估通过就直接建队',
        planAutoTeamHint: '打开后，预估通过就直接建队派活，不必等你当场再说一次；关掉则仍要你明确要求。',
        planAutoTeamLocked: '要先勾上 Agent Teams 通道才起作用。',
        failTitle: '卡住改派',
        failHint: '帮手长时间没有产出时怎么办：先看状态、再换模型/换上游、然后才换成员、最后兜底。这些都写进注入文本，主 agent 会照做。',
        failOn: '帮手卡住就改派',
        failOnHint: '关掉后帮手无响应时不许改派，由主 agent 自己接手。',
        failWait: '多少步没产出算卡住',
        failWaitHint: '主 agent 推进或等待这么多步后帮手还没有任何产出，就判定卡住（1–50）。',
        failRetry: '同一个活最多改派几次',
        failRetryHint: '改派这么多次仍无产出就走兜底；填 0 表示一次不重试（0–3）。',
        failFallback: '兜底谁来做',
        failFallbackHint: '改派用尽之后由谁收尾：主 agent 自己接手，或指定一个已勾选的帮手。',
        failFallbackMain: '主 agent 自己接手',
        notes: '附加要求（会原样写进注入文本）',
        notesPlaceholder: '例如：代码审查的活只能派给 nemotron-3-ultra-free；写文件的活不要派给帮手。',
        save: '保存并生效',
        saving: '保存中…',
        'save.ok': '已保存，下一步起生效。',
        'save.warn': '已生效，但配置写盘失败（重启后会回到旧值）。',
        'save.fail': '保存失败：{message}',
        dirty: '有未保存的改动',
        reset: '恢复默认',
        preview: '查看实际注入给 agent 的策略文本',
        previewHint: '预览是「已保存」的版本；改了上面的开关记得先保存。',
        unsaved: '（有未保存改动，此处仍是旧版）',
        footer: '配置文件：{path}',
        version: '版本',
        enabledPill: '总开关',
        obTitle: '帮手调度台：先配一次',
        obLead: '决定「主 agent 要不要派活、派给谁」。四步配完即生效，随时可关。',
        obOpen: '打开设置去配',
        obDone: '暂时不用',
        guideTitle: '第一次用：四步就好',
        guideLead: '这个插件只做一件事——把「主 agent 要不要派活、派给谁」写成每一步都生效的策略。四步配完即可用，随时可关。',
        guideS1: '勾通道：只勾你真会用的派活方式，没勾的通道会被明确禁止（比「建议不派」硬）。',
        guideS2: '勾帮手：优先挑「车道实测」或「宿主已注册」的行；一个都没有时，用下面的手填加一条 provider:model。',
        guideS3: '定规模：同时最多几个、多长的任务才值得派——这是省 token 与浪费并行的分界线。',
        guideS4: '保存即生效：策略会在下一步注入；不放心就先留在「先问我」。',
        guideDone: '知道了，开始用',
        guideRescan: '先探一次名册',
        adapt: '宿主适配',
        adaptHint: '这些是插件看到的真实环境；哪一项没连上，就只少那一个功能，插件照常可用。',
        svcWebServer: '面板 API（webServer）',
        svcPrompt: '策略注入（systemPrompt）',
        svcLlm: '模型枚举（llm）',
        svcOk: '已连接',
        svcNo: '未连接',
        adaptWritable: '配置目录可写',
        adaptYes: '是',
        adaptNo: '否（仅内存生效）',
        adaptHome: 'DSH_HOME',
        adaptScanned: '名册刷新于',
        adaptFound: '探到的车道',
        adaptNoPeers: '没发现任何兄弟插件的状态文件——不影响使用，手填照样能派活。',
        adaptModels: '个模型',
        adaptLlmError: '模型枚举失败：{message}',
        adaptLlmHint: 'llm 未连接或枚举为空时，名册只剩车道实测/内置参考；手填一条 provider:model 仍然可用。',
      },
      en: {
        nav: 'Agent dispatch',
        title: 'Agent dispatch',
        subtitle: 'Decide whether other agents help — and which ones may',
        loading: 'Loading configuration…',
        loadFailed: 'Plugin backend unreachable',
        retry: 'Retry',
        on: 'On',
        off: 'Off',
        statHelpers: 'usable helpers',
        statArmed: 'armed',
        statChannels: 'channels',
        statConcurrency: 'max parallel',
        master: 'Let other agents help',
        masterHint: 'On: simple, mechanical, self-contained work goes to free-lane helpers; the hardest, most consequential work — and every judgment call — stays with the main agent. Off: everything stays here.',
        mode: 'Dispatch mode',
        'mode.off': 'Off',
        'mode.ask': 'Ask me',
        'mode.auto': 'Auto',
        'modeHint.off': 'No delegation at all this session.',
        'modeHint.ask': 'Asks before dispatching helpers.',
        'modeHint.auto': 'Dispatches whenever the rules match.',
        channels: 'Helper channels',
        channelsHint: 'Unchecked channels are explicitly forbidden in the injected policy.',
        roster: 'Helper roster',
        rosterHint: 'Three sources merged: host-registered, lane probe, manual. Only checked rows may be used. State is a probe snapshot: "available" means the model answered when the lane was probed, not that it is not deprecated or throttled — switch models when a real call fails.',
        colHelper: 'Helper',
        colSource: 'Source',
        colState: 'State',
        srcPeer: 'lane probe',
        srcLlm: 'host-registered',
        srcManual: 'manual',
        srcSeed: 'built-in',
        srcSeedHint: 'Built-in reference only — not confirmed on this host. Add it manually, or check the provider name.',
        measuredAt: 'measured',
        never: 'never probed',
        rescan: 'Rescan',
        rescanning: 'Scanning…',
        stateAvailable: 'available',
        stateRegion: 'region-blocked',
        stateUnavailable: 'unavailable',
        stateThrottled: 'throttled',
        stateUnknown: 'unknown',
        ttft: 'TTFT',
        setPrimary: 'Set as default',
        primary: 'default',
        remove: 'Remove',
        addTitle: 'Add a helper by hand (any provider)',
        addProvider: 'provider',
        addModel: 'model',
        addBtn: 'Add to roster',
        addHint: 'As long as the host has that provider, dispatch works — this plugin needs no other plugin installed.',
        addDup: 'Already in the roster.',
        addBad: 'Both provider and model are required.',
        scale: 'Dispatch budget',
        concurrency: 'Max parallel helpers',
        minSteps: 'Dispatch only past N steps',
        longTaskOnly: 'Never dispatch quick jobs',
        longTaskOnlyHint: 'One-liner tasks stay with the main agent.',
        plan: 'Pre-flight estimate',
        planHint: 'One sentence before starting: can this be split into independent blocks, each with a self-contained prompt? The answer decides whether to dispatch — and whether to build a team.',
        planOn: 'Estimate before every run',
        planOnHint: 'Off: no per-run estimate; the dispatch rules decide on their own.',
        planMinBlocks: 'Blocks needed for a team',
        planMinBlocksHint: 'This many independent blocks are worth a team (2–8).',
        planAutoTeam: 'Build the team when the estimate passes',
        planAutoTeamHint: 'On: a passing estimate creates the team on the spot, without a fresh request; off: it still waits for your explicit word.',
        planAutoTeamLocked: 'Check the Agent Teams channel first.',
        failTitle: 'Stall failover',
        failHint: 'What happens when a helper stops producing: check the state, switch the model / upstream first, switch members only after that, then fall back. Written into the injected policy, so the main agent follows it.',
        failOn: 'Reassign stalled helpers',
        failOnHint: 'Off: no reassignment — the main agent takes the work back itself.',
        failWait: 'Steps without output before stalled',
        failWaitHint: 'After this many steps of waiting with no output, the helper counts as stalled (1–50).',
        failRetry: 'Reassignments per unit of work',
        failRetryHint: 'After this many, it falls back; 0 means never retry (0–3).',
        failFallback: 'Who finishes it',
        failFallbackHint: 'Once reassignment runs out: the main agent takes over, or a named checked helper finishes.',
        failFallbackMain: 'Main agent takes over',
        notes: 'Extra instructions (injected verbatim)',
        notesPlaceholder: 'e.g. code review only to nemotron-3-ultra-free',
        save: 'Save & apply',
        saving: 'Saving…',
        'save.ok': 'Saved — effective from the next step.',
        'save.warn': 'Applied, but writing the file failed (reverts on restart).',
        'save.fail': 'Save failed: {message}',
        dirty: 'Unsaved changes',
        reset: 'Reset to defaults',
        preview: 'Show the policy text injected into the agent',
        previewHint: 'Preview shows the saved version.',
        unsaved: '(unsaved changes — this is the old version)',
        footer: 'Config file: {path}',
        version: 'version',
        enabledPill: 'Master',
        obTitle: 'Agent dispatch: one setup pass',
        obLead: 'Decides whether other agents help and which ones may — four steps, effective from the next step, switchable any time.',
        obOpen: 'Open settings',
        obDone: 'Not now',
        guideTitle: 'First run: four steps',
        guideLead: 'This plugin does one thing — it renders "should the main agent delegate, and to whom" into a policy that is live on every step. Configure it in four steps; switch it off any time.',
        guideS1: 'Pick channels: only the ones you will really use. Unchecked channels are explicitly forbidden, not merely discouraged.',
        guideS2: 'Pick helpers: prefer rows tagged lane probe or host-registered. If there are none, add a provider:model by hand below.',
        guideS3: 'Set the budget: how many run at once, and how long a job must be to deserve a helper.',
        guideS4: 'Save and it applies on the next step. Stay on "Ask me" until you trust it.',
        guideDone: 'Got it',
        guideRescan: 'Probe the roster now',
        adapt: 'Host adaptation',
        adaptHint: 'What the plugin actually sees. A missing item removes one feature — never the whole panel.',
        svcWebServer: 'Panel API (webServer)',
        svcPrompt: 'Policy injection (systemPrompt)',
        svcLlm: 'Model enumeration (llm)',
        svcOk: 'connected',
        svcNo: 'not connected',
        adaptWritable: 'Config directory writable',
        adaptYes: 'yes',
        adaptNo: 'no (memory only)',
        adaptHome: 'DSH_HOME',
        adaptScanned: 'Roster refreshed',
        adaptFound: 'Lanes found',
        adaptNoPeers: 'No sibling plugin state files found — nothing breaks; manual entries still dispatch.',
        adaptModels: 'models',
        adaptLlmError: 'Model enumeration failed: {message}',
        adaptLlmHint: 'Without llm enumeration the roster falls back to lane probes and built-in seeds; a manual provider:model entry still works.',
      },
    }

    // ── Styles (all from theme variables) ────────────────────────────────────────────────
    const CSS = `
.ad_root{display:flex;flex-direction:column;gap:16px;max-width:1080px;font-size:13px;line-height:1.55;color:var(--dsw-alias-label-primary);box-sizing:border-box}
.ad_root *{box-sizing:border-box}
.ad_hero{display:flex;flex-direction:column;gap:10px;padding:18px 20px;border-radius:16px;border:1px solid var(--dsw-alias-border-l2);background:linear-gradient(160deg,var(--dsw-alias-bg-layer-3),var(--dsw-alias-bg-layer-1))}
.ad_h1{margin:0;font-size:17px;font-weight:650;letter-spacing:.3px}
.ad_tagline{margin:0;color:var(--dsw-alias-label-secondary);font-size:12.5px;max-width:62ch}
.ad_pills{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.ad_pill{display:inline-flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-2);font-size:11.5px;color:var(--dsw-alias-label-secondary);white-space:nowrap}
.ad_pill b{color:var(--dsw-alias-label-primary);font-weight:600;font-variant-numeric:tabular-nums}
.ad_dot{width:6px;height:6px;border-radius:50%;flex:none;background:var(--dsw-alias-label-tertiary)}
.ad_dot.ok{background:var(--dsw-alias-state-success-primary)}
.ad_dot.off{background:var(--dsw-alias-state-error-primary)}
.ad_sec{display:flex;flex-direction:column;gap:10px}
.ad_sechead{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;padding-bottom:6px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.ad_sechead h3{margin:0;font-size:13.5px;font-weight:650}
.ad_sechint{margin-left:auto;flex:1 1 160px;font-size:11.5px;color:var(--dsw-alias-label-tertiary);text-align:right}
.ad_card{padding:13px 14px;border-radius:13px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);display:flex;flex-direction:column;gap:12px}
.ad_row{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.ad_rowmain{display:flex;flex-direction:column;gap:2px;min-width:0}
.ad_label{font-size:12.5px;font-weight:600}
.ad_sub{font-size:11.5px;color:var(--dsw-alias-label-tertiary);line-height:1.5}
.ad_grow{flex:1;min-width:0}
/* A hint that shares a row with a fixed-width control: give it a real wrap basis so a narrow
   container moves it onto its own line instead of squeezing it to one character per line. */
.ad_sub.ad_grow{flex:1 1 200px}
.ad_switch{display:inline-flex;align-items:center;gap:9px;cursor:pointer;border:0;background:transparent;padding:0;font:inherit;color:inherit}
.ad_switch i{width:34px;height:20px;border-radius:999px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);position:relative;transition:background .16s ease,border-color .16s ease;flex:none}
.ad_switch i::after{content:"";position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:var(--dsw-alias-label-secondary);transition:transform .16s ease,background .16s ease}
.ad_switch[aria-checked="true"] i{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}
.ad_switch[aria-checked="true"] i::after{transform:translateX(14px);background:var(--dsw-alias-label-on-accent)}
.ad_seg{display:inline-flex;padding:2px;border-radius:9px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);gap:2px}
.ad_seg button{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:11.5px;padding:3px 12px;border-radius:7px;cursor:pointer}
.ad_seg button[aria-pressed="true"]{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);box-shadow:0 1px 2px rgb(0 0 0 / 12%)}
.ad_list{display:flex;flex-direction:column;gap:2px}
.ad_chan{display:flex;align-items:flex-start;gap:12px;padding:9px 2px;border-bottom:1px solid var(--dsw-alias-border-l1)}
.ad_chan:last-child{border-bottom:0}
.ad_table{width:100%;border-collapse:collapse;font-size:12px}
.ad_table th{text-align:left;font-weight:500;color:var(--dsw-alias-label-tertiary);padding:0 8px 6px;border-bottom:1px solid var(--dsw-alias-border-l1);white-space:nowrap;font-size:11px}
.ad_table td{padding:7px 8px;border-bottom:1px solid var(--dsw-alias-border-l1);vertical-align:middle}
.ad_table tr:last-child td{border-bottom:0}
.ad_table tr.ad_disarmed td{opacity:.55}
.ad_id{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px;display:block}
.ad_badge{display:inline-block;font-size:10.5px;padding:2px 7px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);white-space:nowrap;color:var(--dsw-alias-label-tertiary);background:transparent}
.ad_badge.available{color:var(--dsw-alias-state-success-primary);border-color:var(--dsw-alias-state-success-primary)}
.ad_badge.region-blocked{color:var(--dsw-alias-state-warning-primary);border-color:var(--dsw-alias-state-warning-primary)}
.ad_badge.unavailable,.ad_badge.throttled{color:var(--dsw-alias-state-error-primary);border-color:var(--dsw-alias-state-error-primary)}
.ad_badge.unknown{color:var(--dsw-alias-label-tertiary);border-color:var(--dsw-alias-border-l2)}
.ad_src{display:inline-block;font-size:10.5px;padding:2px 7px;border-radius:6px;border:1px dashed var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.ad_lat{display:flex;align-items:center;gap:8px;min-width:120px}
.ad_bar{flex:1;height:5px;border-radius:99px;background:var(--dsw-alias-bg-layer-1);overflow:hidden;min-width:40px}
.ad_bar i{display:block;height:100%;border-radius:99px;background:var(--dsw-alias-state-business-primary)}
.ad_bar i.slow{background:var(--dsw-alias-state-warning-primary)}
.ad_num{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary);white-space:nowrap;font-size:11.5px}
.ad_check{width:15px;height:15px;accent-color:var(--dsw-alias-state-business-primary);cursor:pointer;margin:0}
.ad_star{border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-tertiary);font:inherit;font-size:10.5px;padding:2px 8px;border-radius:999px;cursor:pointer;white-space:nowrap}
.ad_star[aria-pressed="true"]{color:var(--dsw-alias-label-on-accent);background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary)}
.ad_x{border:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11.5px;cursor:pointer;padding:2px 6px;border-radius:7px}
.ad_x:hover{color:var(--dsw-alias-state-error-primary)}
.ad_grid{display:flex;gap:14px;flex-wrap:wrap}
.ad_field{display:flex;flex-direction:column;gap:4px;min-width:180px;flex:1}
.ad_field>span{font-size:11.5px;color:var(--dsw-alias-label-tertiary)}
.ad_input,.ad_area{font:inherit;font-size:12px;padding:6px 9px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);min-width:0;width:100%}
.ad_area{min-height:64px;resize:vertical;line-height:1.6}
.ad_input:focus,.ad_area:focus{outline:none;border-color:var(--dsw-alias-state-business-primary)}
.ad_select{font:inherit;font-size:12px;padding:6px 9px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);min-width:0;width:100%}
.ad_select:focus{outline:none;border-color:var(--dsw-alias-state-business-primary)}
.ad_select:disabled{opacity:.55}
.ad_actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:2px}
.ad_btn{font:inherit;font-size:12px;padding:6px 14px;border-radius:9px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-primary);cursor:pointer}
.ad_btn:hover:not(:disabled){border-color:var(--dsw-alias-state-business-primary)}
.ad_btn:disabled{opacity:.55;cursor:default}
.ad_btn.primary{background:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-on-accent)}
.ad_status{font-size:11.5px;color:var(--dsw-alias-label-tertiary)}
.ad_status.idle{color:var(--dsw-alias-label-tertiary)}
.ad_status.ok{color:var(--dsw-alias-state-success-primary)}
.ad_status.warn{color:var(--dsw-alias-state-warning-primary)}
.ad_status.err{color:var(--dsw-alias-state-error-primary)}
.ad_dirty{color:var(--dsw-alias-state-warning-primary);font-size:11.5px}
.ad_details{border:1px solid var(--dsw-alias-border-l2);border-radius:11px;background:var(--dsw-alias-bg-layer-2);padding:10px 12px}
.ad_details>summary{cursor:pointer;font-size:12px;font-weight:600}
.ad_pre{margin:9px 0 0;padding:11px 12px;border-radius:10px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11px;line-height:1.7;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dsw-alias-label-secondary);max-height:340px;overflow:auto}
.ad_callout{display:flex;gap:9px;padding:10px 12px;border-radius:11px;border:1px solid var(--dsw-alias-state-warning-primary);background:color-mix(in srgb,var(--dsw-alias-state-warning-primary) 10%,transparent);font-size:11.5px;line-height:1.55;color:var(--dsw-alias-label-secondary)}
.ad_guide{border-color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,var(--dsw-alias-bg-layer-3))}
.ad_steps{display:flex;flex-direction:column;gap:8px}
.ad_step{display:flex;gap:10px;align-items:flex-start}
.ad_stepnum{flex:none;width:19px;height:19px;border-radius:50%;border:1px solid var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary);font-size:11px;display:flex;align-items:center;justify-content:center;font-variant-numeric:tabular-nums}
.ad_kv{display:flex;gap:8px;flex-wrap:wrap}
.ad_foot{font-size:11px;color:var(--dsw-alias-label-tertiary);word-break:break-all}
.ad_off{opacity:.5}
/* Onboarding card: the host mounts settings.onboarding in the narrow sidebar column, so this one
   carries its own chrome and its own layout — it never inherits the panel's grid. */
.ad_ob{display:flex;flex-direction:column;gap:10px;max-width:100%;padding:13px 14px;border-radius:13px;border:1px solid var(--dsw-alias-state-business-primary);background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 8%,var(--dsw-alias-bg-layer-3));font-size:12.5px;line-height:1.55;color:var(--dsw-alias-label-primary);box-sizing:border-box}
.ad_ob *{box-sizing:border-box}
.ad_obhead{display:flex;align-items:center;gap:8px}
.ad_obdot{flex:none;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-business-primary)}
.ad_obtitle{margin:0;font-size:13px;font-weight:650}
.ad_oblead{margin:0;color:var(--dsw-alias-label-secondary);font-size:11.5px;line-height:1.55}
.ad_obsteps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}
.ad_obsteps li{display:flex;align-items:flex-start;gap:8px;font-size:11.5px;color:var(--dsw-alias-label-secondary)}
.ad_obact{display:flex;gap:8px;flex-wrap:wrap;padding-top:2px}
`

    // ── HTTP ─────────────────────────────────────────────────────────────────
    async function api(pathname, options) {
      const response = await fetch(`${API}${pathname}`, {
        headers: { 'content-type': 'application/json' },
        ...options,
      })
      const text = await response.text()
      let payload = {}
      try { payload = text === '' ? {} : JSON.parse(text) } catch { payload = {} }
      if (!response.ok) throw new Error(payload?.error ?? `HTTP ${response.status}`)
      return payload
    }

    // ── Utilities ────────────────────────────────────────────────────────────────
    function seconds(ms) {
      if (!Number.isFinite(ms) || ms <= 0) return '—'
      return `${(ms / 1000).toFixed(2)}s`
    }
    function clock(ts) {
      if (!Number.isFinite(ts) || ts <= 0) return ''
      try { return new Date(ts).toLocaleString() } catch { return '' }
    }
    function same(a, b) {
      try { return JSON.stringify(a) === JSON.stringify(b) } catch { return true }
    }
    /** Helper key provider:model → two segments (same rule as the host half's splitKey). */
    function splitKey(key) {
      const text = String(key ?? '')
      const at = text.indexOf(':')
      if (at < 0) return { provider: '', model: text }
      return { provider: text.slice(0, at), model: text.slice(at + 1) }
    }
    const SOURCE_LABEL = { peer: 'srcPeer', llm: 'srcLlm', manual: 'srcManual', seed: 'srcSeed' }

    /** A themed toggle: native button driven by aria-checked for CSS. */
    function Toggle({ checked, onChange, label, disabled }) {
      return h('button', {
        type: 'button',
        className: 'ad_switch',
        role: 'switch',
        'aria-checked': checked ? 'true' : 'false',
        disabled: disabled === true,
        onClick: () => { if (disabled !== true) onChange(!checked) },
      }, h('i', null), label ? h('span', { className: 'ad_label' }, label) : null)
    }

    /** Source tag: tells the user this row is from "lane probe / host-registered / manual / built-in reference". */
    function SourceTag({ row, t }) {
      return h('span', { className: 'ad_src', title: row.source === 'seed' ? t('srcSeedHint') : '' }, t(SOURCE_LABEL[row.source] ?? 'srcSeed'))
    }

    // ── Panel ─────────────────────────────────────────────────────────────────
    function Panel(props) {
      const t = props.t
      const [data, setData] = useState(undefined)
      const [draft, setDraft] = useState(undefined)
      const [error, setError] = useState('')
      const [status, setStatus] = useState({ kind: 'idle', text: '' })
      const [busy, setBusy] = useState('')
      const [adding, setAdding] = useState({ provider: '', model: '' })
      const statusTimer = useRef(null)

      const adopt = useCallback(payload => {
        setData(payload)
        setDraft(JSON.parse(JSON.stringify(payload.config)))
      }, [])

      const load = useCallback(async () => {
        setError('')
        try { adopt(await api('/summary')) } catch (e) { setError(String(e?.message ?? e)) }
      }, [adopt])

      useEffect(() => { void load() }, [load])
      useEffect(() => () => { if (statusTimer.current) clearTimeout(statusTimer.current) }, [])

      const flash = useCallback((kind, text) => {
        setStatus({ kind, text })
        if (statusTimer.current) clearTimeout(statusTimer.current)
        statusTimer.current = setTimeout(() => setStatus({ kind: 'idle', text: '' }), 4000)
      }, [])

      const save = useCallback(async () => {
        setBusy('save')
        try {
          const next = await api('/config', { method: 'POST', body: JSON.stringify({ patch: draft }) })
          adopt(next)
          flash(next.writeError ? 'warn' : 'ok', next.writeError ? t('save.warn') : t('save.ok'))
        } catch (e) {
          flash('err', t('save.fail').replace('{message}', String(e?.message ?? e)))
        } finally { setBusy('') }
      }, [adopt, draft, flash, t])

      const reset = useCallback(async () => {
        setBusy('reset')
        try {
          const next = await api('/reset', { method: 'POST', body: '{}' })
          adopt(next)
          flash('ok', t('save.ok'))
        } catch (e) {
          flash('err', t('save.fail').replace('{message}', String(e?.message ?? e)))
        } finally { setBusy('') }
      }, [adopt, flash, t])

      const rescan = useCallback(async () => {
        setBusy('rescan')
        try {
          const next = await api('/rescan', { method: 'POST', body: '{}' })
          setData(next)
        } catch (e) {
          flash('err', String(e?.message ?? e))
        } finally { setBusy('') }
      }, [flash])

      /** The "Got it" button on the onboarding card: saves draft and seen together without losing the user's unsaved changes. */
      const finishGuide = useCallback(async () => {
        setBusy('guide')
        try {
          const next = await api('/config', {
            method: 'POST',
            body: JSON.stringify({ patch: { ...(draft ?? {}), onboarding: { seen: true } } }),
          })
          adopt(next)
          flash(next.writeError ? 'warn' : 'ok', next.writeError ? t('save.warn') : t('save.ok'))
        } catch (e) {
          flash('err', t('save.fail').replace('{message}', String(e?.message ?? e)))
        } finally { setBusy('') }
      }, [adopt, draft, flash, t])

      const patch = useCallback(part => { setDraft(current => ({ ...current, ...part })) }, [])
      const patchNested = useCallback((key, id, value) => {
        setDraft(current => ({ ...current, [key]: { ...(current[key] ?? {}), [id]: value } }))
      }, [])

      const dirty = useMemo(() => (data && draft ? !same(data.config, draft) : false), [data, draft])

      if (error !== '') {
        return h('div', { className: 'ad_root' },
          h('div', { className: 'ad_callout' },
            h('span', null, `${t('loadFailed')}：${error}`),
            h('button', { type: 'button', className: 'ad_btn', onClick: () => { void load() } }, t('retry'))))
      }
      if (!data || !draft) {
        return h('div', { className: 'ad_root' }, h('p', { className: 'ad_sub' }, t('loading')))
      }

      const health = data.health ?? { services: {}, roster: { sources: {} }, peers: [], llm: { providers: [] } }
      const rows = data.roster?.rows ?? []
      const knownKeys = new Set(rows.map(row => row.key))
      // Manually-added entries not yet saved / not in the roster yet: render them as rows first so the user can see what they just added.
      const extras = Object.entries(draft.helpers ?? {})
        .filter(([key, value]) => value?.enabled === true && !knownKeys.has(key))
        .map(([key]) => {
          const parts = splitKey(key)
          return { key, provider: parts.provider, model: parts.model, name: parts.model, state: 'unknown', ttftMs: 0, verified: false, source: 'manual' }
        })
      const tableRows = [...rows, ...extras]
      const maxTtft = Math.max(1, ...tableRows.map(row => (row.state === 'available' ? row.ttftMs : 0)))
      const off = draft.enabled !== false && draft.mode !== 'off'
      const armedKeys = tableRows.filter(row => draft.helpers?.[row.key]?.enabled === true).map(row => row.key)
      const peers = Array.isArray(health.peers) ? health.peers : []

      const header = h('div', { className: 'ad_hero' },
        h('h2', { className: 'ad_h1' }, t('title')),
        h('p', { className: 'ad_tagline' }, t('subtitle')),
        h('div', { className: 'ad_pills' },
          h('span', { className: 'ad_pill' },
            h('i', { className: `ad_dot ${off ? 'ok' : 'off'}` }),
            `${t('enabledPill')}: `, h('b', null, off ? `${t('on')} · ${t(`mode.${draft.mode}`)}` : t('off'))),
          h('span', { className: 'ad_pill' }, `${t('statHelpers')} `, h('b', null, `${data.stats.available}/${data.stats.rosterTotal}`)),
          h('span', { className: 'ad_pill' }, `${t('statArmed')} `, h('b', null, String(armedKeys.length))),
          h('span', { className: 'ad_pill' }, `${t('statChannels')} `, h('b', null, String(data.stats.channels))),
          h('span', { className: 'ad_pill' }, `${t('statConcurrency')} `, h('b', null, String(draft.maxHelpers)))))

      // 0) First-run onboarding — shown once, then gone
      const guide = health.onboardingSeen === true ? null : h('div', { className: 'ad_card ad_guide' },
        h('div', { className: 'ad_row' },
          h('h3', { className: 'ad_h1', style: { fontSize: '14px' } }, t('guideTitle')),
          h('span', { className: 'ad_grow' })),
        h('p', { className: 'ad_sub', style: { margin: 0 } }, t('guideLead')),
        h('div', { className: 'ad_steps' },
          ['guideS1', 'guideS2', 'guideS3', 'guideS4'].map((key, index) => h('div', { key, className: 'ad_step' },
            h('span', { className: 'ad_stepnum' }, String(index + 1)),
            h('span', { className: 'ad_sub', style: { flex: 1 } }, t(key))))),
        h('div', { className: 'ad_actions' },
          h('button', { type: 'button', className: 'ad_btn primary', disabled: busy === 'guide', onClick: () => { void finishGuide() } }, t('guideDone')),
          h('button', { type: 'button', className: 'ad_btn', disabled: busy === 'rescan', onClick: () => { void rescan() } },
            busy === 'rescan' ? t('rescanning') : t('guideRescan'))))

      // 1) Master switch + mode
      const master = h('div', { className: 'ad_sec' },
        h('div', { className: 'ad_row' },
          h(Toggle, { checked: draft.enabled !== false, onChange: value => patch({ enabled: value, ...(value && draft.mode === 'off' ? { mode: 'ask' } : {}) }), label: t('master') }),
          h('span', { className: 'ad_grow ad_sub' }, t('masterHint'))),
        h('div', { className: 'ad_row' },
          h('span', { className: 'ad_label' }, t('mode')),
          h('div', { className: 'ad_seg' }, ['off', 'ask', 'auto'].map(mode => h('button', {
            key: mode,
            type: 'button',
            'aria-pressed': (draft.enabled === false ? 'off' : draft.mode) === mode ? 'true' : 'false',
            onClick: () => patch(mode === 'off' ? { mode } : { mode, enabled: true }),
          }, t(`mode.${mode}`)))),
          h('span', { className: 'ad_grow ad_sub' }, t(`modeHint.${draft.enabled === false ? 'off' : draft.mode}`))))

      // 2) Channels
      const channels = h('div', { className: 'ad_sec' },
        h('div', { className: 'ad_sechead' }, h('h3', null, t('channels')), h('span', { className: 'ad_sechint' }, t('channelsHint'))),
        h('div', { className: `ad_card ${off ? '' : 'ad_off'}` },
          h('div', { className: 'ad_list' }, data.channels.map(channel => h('div', { key: channel.id, className: 'ad_chan' },
            h(Toggle, {
              checked: draft.channels?.[channel.id] === true,
              disabled: !off,
              onChange: value => patchNested('channels', channel.id, value),
            }),
            h('div', { className: 'ad_rowmain ad_grow' },
              h('span', { className: 'ad_label' }, channel.label),
              h('span', { className: 'ad_sub' }, channel.hint)))))))

      // 3) Roster + manual add
      const roster = h('div', { className: 'ad_sec' },
        h('div', { className: 'ad_sechead' },
          h('h3', null, t('roster')),
          h('span', { className: 'ad_sechint' },
            peers.length > 0 ? `${t('adaptFound')}: ${peers.map(peer => `${peer.name}(${peer.models})`).join(' · ')}` : '',
            health.roster?.scannedAt ? ` · ${t('adaptScanned')} ${clock(health.roster.scannedAt)}` : '')),
        peers.length === 0 ? h('div', { className: 'ad_callout' }, h('span', null, t('adaptNoPeers'))) : null,
        peers.some(peer => peer.enabled === false) ? h('div', { className: 'ad_callout' },
          h('span', null, `${peers.filter(peer => peer.enabled === false).map(peer => peer.name).join(' / ')} — ${t('srcSeedHint')}`)) : null,
        h('div', { className: `ad_card ${off ? '' : 'ad_off'}` },
          h('div', { className: 'ad_actions' },
            h('button', { type: 'button', className: 'ad_btn', disabled: busy === 'rescan', onClick: () => { void rescan() } },
              busy === 'rescan' ? t('rescanning') : t('rescan')),
            h('span', { className: 'ad_sub ad_grow' }, t('rosterHint'))),
          h('table', { className: 'ad_table' },
            h('thead', null, h('tr', null,
              h('th', null, ''),
              h('th', null, ''),
              h('th', null, t('colHelper')),
              h('th', null, t('colSource')),
              h('th', null, t('colState')),
              h('th', null, t('ttft')),
              h('th', null, ''))),
            h('tbody', null, tableRows.map(row => {
              const armed = draft.helpers?.[row.key]?.enabled === true
              const isPrimary = draft.primary === row.key
              const pct = row.state === 'available' && row.ttftMs > 0 ? Math.max(6, Math.round((row.ttftMs / maxTtft) * 100)) : 0
              const slow = row.state === 'available' && pct >= 60
              const blocked = row.state === 'unavailable' || row.state === 'region-blocked'
              return h('tr', { key: row.key, className: armed ? '' : 'ad_disarmed' },
                h('td', { style: { width: 20 } }, h('input', {
                  type: 'checkbox',
                  className: 'ad_check',
                  checked: armed,
                  disabled: !off,
                  onChange: event => {
                    patchNested('helpers', row.key, { enabled: event.target.checked })
                    if (event.target.checked && (draft.primary === '' || draft.primary === undefined)) patch({ primary: row.key })
                  },
                })),
                h('td', { style: { width: 96 } }, h('button', {
                  type: 'button',
                  className: 'ad_star',
                  'aria-pressed': isPrimary ? 'true' : 'false',
                  title: armed ? t('setPrimary') : t('rosterHint'),
                  disabled: !off || !armed || blocked,
                  onClick: () => patch({ primary: row.key }),
                }, isPrimary ? `★ ${t('primary')}` : t('setPrimary'))),
                h('td', null,
                  h('span', { className: 'ad_label' }, row.name),
                  h('code', { className: 'ad_id' }, row.key)),
                h('td', { style: { width: 112 } }, h(SourceTag, { row, t })),
                h('td', { style: { width: 96 } }, h('span', { className: `ad_badge ${row.state}` }, t({
                  available: 'stateAvailable',
                  'region-blocked': 'stateRegion',
                  unavailable: 'stateUnavailable',
                  throttled: 'stateThrottled',
                }[row.state] ?? 'stateUnknown'))),
                h('td', { style: { width: 150 } },
                  h('div', { className: 'ad_lat' },
                    h('span', { className: 'ad_num' }, seconds(row.ttftMs)),
                    pct > 0 ? h('span', { className: 'ad_bar' }, h('i', { className: slow ? 'slow' : '', style: { width: `${pct}%` } })) : null)),
                h('td', { style: { width: 60 } }, h('button', {
                  type: 'button',
                  className: 'ad_x',
                  title: t('remove'),
                  disabled: !off,
                  onClick: () => {
                    setDraft(current => {
                      const helpers = { ...(current.helpers ?? {}) }
                      delete helpers[row.key]
                      return { ...current, helpers }
                    })
                  },
                }, '×')))}))),
          h('div', { className: 'ad_sechead', style: { borderBottom: 0, paddingBottom: 0 } },
            h('h3', null, t('addTitle'))),
          h('div', { className: 'ad_grid' },
            h('label', { className: 'ad_field' },
              h('span', null, t('addProvider')),
              h('input', {
                className: 'ad_input', list: 'ad_providers', value: adding.provider, placeholder: 'our-free-model',
                onChange: event => setAdding(current => ({ ...current, provider: event.target.value.trim() })),
              })),
            h('label', { className: 'ad_field' },
              h('span', null, t('addModel')),
              h('input', {
                className: 'ad_input', value: adding.model, placeholder: 'nemotron-3-ultra-free',
                onChange: event => setAdding(current => ({ ...current, model: event.target.value.trim() })),
              })),
            h('button', {
              type: 'button', className: 'ad_btn', disabled: !off,
              onClick: () => {
                if (adding.provider === '' || adding.model === '') { flash('err', t('addBad')); return }
                const key = `${adding.provider}:${adding.model}`
                if (draft.helpers?.[key] !== undefined || knownKeys.has(key)) { flash('warn', t('addDup')); return }
                patchNested('helpers', key, { enabled: true })
                setAdding({ provider: '', model: '' })
              },
            }, t('addBtn'))),
          h('datalist', { id: 'ad_providers' }, (data.providers ?? []).map(provider => h('option', { key: provider.id, value: provider.id }))),
          h('span', { className: 'ad_sub' }, t('addHint'))))

      // 4) Scale + notes
      const scale = h('div', { className: 'ad_sec' },
        h('div', { className: 'ad_sechead' }, h('h3', null, t('scale'))),
        h('div', { className: `ad_card ${off ? '' : 'ad_off'}` },
          h('div', { className: 'ad_grid' },
            h('label', { className: 'ad_field' },
              h('span', null, t('concurrency')),
              h('input', {
                type: 'number', min: 1, max: 8, className: 'ad_input', value: draft.maxHelpers,
                onChange: event => patch({ maxHelpers: Number(event.target.value) }),
              })),
            h('label', { className: 'ad_field' },
              h('span', null, t('minSteps')),
              h('input', {
                type: 'number', min: 1, max: 20, className: 'ad_input', value: draft.minSteps,
                onChange: event => patch({ minSteps: Number(event.target.value) }),
              }))),
          h('div', { className: 'ad_row' },
            h(Toggle, { checked: draft.longTaskOnly === true, disabled: !off, onChange: value => patch({ longTaskOnly: value }), label: t('longTaskOnly') }),
            h('span', { className: 'ad_grow ad_sub' }, t('longTaskOnlyHint'))),
          h('label', { className: 'ad_field' },
            h('span', null, t('notes')),
            h('textarea', {
              className: 'ad_area', value: draft.notes ?? '', placeholder: t('notesPlaceholder'),
              onChange: event => patch({ notes: event.target.value }),
            }))))

      // 5) Pre-flight estimate: whether to spend a sentence deciding before any work starts
      const planCfg = draft.plan ?? { enabled: true, minBlocks: 2, autoTeam: true }
      const teamsArmed = draft.channels?.teams === true
      const planSec = h('div', { className: 'ad_sec' },
        h('div', { className: 'ad_sechead' }, h('h3', null, t('plan')), h('span', { className: 'ad_sechint' }, t('planHint'))),
        h('div', { className: `ad_card ${off ? '' : 'ad_off'}` },
          h('div', { className: 'ad_row' },
            h(Toggle, { checked: planCfg.enabled !== false, disabled: !off, onChange: value => patchNested('plan', 'enabled', value), label: t('planOn') }),
            h('span', { className: 'ad_grow ad_sub' }, t('planOnHint'))),
          h('div', { className: 'ad_grid' },
            h('label', { className: 'ad_field' },
              h('span', null, t('planMinBlocks')),
              h('input', {
                type: 'number', min: 2, max: 8, className: 'ad_input', value: planCfg.minBlocks, disabled: !off,
                onChange: event => patchNested('plan', 'minBlocks', Number(event.target.value)),
              }),
              h('span', null, t('planMinBlocksHint')))),
          h('div', { className: 'ad_row' },
            h(Toggle, { checked: planCfg.autoTeam !== false, disabled: !off || !teamsArmed, onChange: value => patchNested('plan', 'autoTeam', value), label: t('planAutoTeam') }),
            h('span', { className: 'ad_grow ad_sub' }, teamsArmed ? t('planAutoTeamHint') : t('planAutoTeamLocked')))))

      // 6) Stall failover: what the main agent does when a helper stops producing
      const failCfg = draft.failover ?? { enabled: true, waitSteps: 6, maxRetry: 1, fallback: 'main' }
      const fallbackKey = failCfg.fallback ?? 'main'
      const fallbackOptions = [...new Set([
        'main',
        ...armedKeys,
        ...(fallbackKey !== 'main' ? [fallbackKey] : []),
      ])]
      const failSec = h('div', { className: 'ad_sec' },
        h('div', { className: 'ad_sechead' }, h('h3', null, t('failTitle')), h('span', { className: 'ad_sechint' }, t('failHint'))),
        h('div', { className: `ad_card ${off ? '' : 'ad_off'}` },
          h('div', { className: 'ad_row' },
            h(Toggle, { checked: failCfg.enabled !== false, disabled: !off, onChange: value => patchNested('failover', 'enabled', value), label: t('failOn') }),
            h('span', { className: 'ad_grow ad_sub' }, t('failOnHint'))),
          h('div', { className: 'ad_grid' },
            h('label', { className: 'ad_field' },
              h('span', null, t('failWait')),
              h('input', {
                type: 'number', min: 1, max: 50, className: 'ad_input', value: failCfg.waitSteps, disabled: !off,
                onChange: event => patchNested('failover', 'waitSteps', Number(event.target.value)),
              }),
              h('span', null, t('failWaitHint'))),
            h('label', { className: 'ad_field' },
              h('span', null, t('failRetry')),
              h('input', {
                type: 'number', min: 0, max: 3, className: 'ad_input', value: failCfg.maxRetry, disabled: !off,
                onChange: event => patchNested('failover', 'maxRetry', Number(event.target.value)),
              }),
              h('span', null, t('failRetryHint'))),
            h('label', { className: 'ad_field' },
              h('span', null, t('failFallback')),
              h('select', {
                className: 'ad_select', value: fallbackKey, disabled: !off,
                onChange: event => patchNested('failover', 'fallback', event.target.value),
              }, fallbackOptions.map(key => h('option', { key, value: key }, key === 'main' ? t('failFallbackMain') : key))),
              h('span', null, t('failFallbackHint'))))))

      // 7) Actions + preview
      const actions = h('div', { className: 'ad_actions' },
        h('button', { type: 'button', className: 'ad_btn primary', disabled: busy === 'save', onClick: () => { void save() } },
          busy === 'save' ? t('saving') : t('save')),
        dirty ? h('span', { className: 'ad_dirty' }, t('dirty')) : null,
        h('button', { type: 'button', className: 'ad_btn', disabled: busy === 'reset', onClick: () => { void reset() } }, t('reset')),
        status.text !== '' ? h('span', { className: `ad_status ${status.kind}` }, status.text) : null)

      const preview = h('details', { className: 'ad_details' },
        h('summary', null, t('preview')),
        h('p', { className: 'ad_sub' }, t('previewHint'), dirty ? ` ${t('unsaved')}` : ''),
        h('pre', { className: 'ad_pre' }, data.preview))

      // 6) Host adaptation self-check: explains "which features are or aren't present and why"
      const svc = health.services ?? {}
      const svcRow = (label, ok) => h('span', { key: label, className: 'ad_pill' },
        h('i', { className: `ad_dot ${ok ? 'ok' : 'off'}` }), `${label}: `, h('b', null, ok ? t('svcOk') : t('svcNo')))
      const adapt = h('details', { className: 'ad_details' },
        h('summary', null, t('adapt')),
        h('p', { className: 'ad_sub' }, t('adaptHint')),
        h('div', { className: 'ad_kv' },
          svcRow(t('svcWebServer'), svc.webServer === true),
          svcRow(t('svcPrompt'), svc.systemPrompt === true),
          svcRow(t('svcLlm'), svc.llm === true),
          h('span', { className: 'ad_pill' }, `${t('adaptWritable')}: `, h('b', null, health.writable === true ? t('adaptYes') : t('adaptNo'))),
          h('span', { className: 'ad_pill' }, `${t('adaptHome')} `, h('b', null, health.home ?? ''))),
        peers.length > 0
          ? h('div', { className: 'ad_kv' }, peers.map(peer => h('span', { key: peer.name, className: 'ad_pill' },
            h('i', { className: `ad_dot ${peer.enabled === false ? 'off' : 'ok'}` }),
            `${peer.name}: `, h('b', null, `${peer.models} ${t('adaptModels')}`),
            peer.probedAt ? ` · ${clock(peer.probedAt)}` : ` · ${t('never')}`,
            peer.egress ? ` · ${peer.egress}` : '')))
          : h('p', { className: 'ad_sub' }, t('adaptNoPeers')),
        health.llm?.error ? h('p', { className: 'ad_callout' }, h('span', null, t('adaptLlmError').replace('{message}', health.llm.error))) : null,
        svc.llm !== true ? h('p', { className: 'ad_sub' }, t('adaptLlmHint')) : null)

      const foot = h('p', { className: 'ad_foot' },
        t('footer').replace('{path}', data.meta?.configPath ?? health.configPath ?? ''),
        data.meta?.pluginVersion ? ` · ${t('version')} ${data.meta.pluginVersion}${data.meta.configVersion ? ` (config v${data.meta.configVersion})` : ''}` : '')

      return h('div', { className: 'ad_root' }, header, guide, master, channels, roster, scale, planSec, failSec, actions, preview, adapt, foot)
    }

    // ── Onboarding card (settings.onboarding) ────────────────────────────────────────────
    /**
     * The host mounts `settings.onboarding` inside the sidebar's settings area — a narrow column —
     * and expects the step to own its own visible chrome: render null while private facts are still
     * loading, then either show its card or hand ownership back through `complete()`.
     * So this is a compact card of its own, never the settings panel (that one is laid out for the
     * wide settings modal and collapses when it is squeezed into a column this narrow).
     */
    function OnboardingCard({ t, complete, openSection, explicit }) {
      const [seen, setSeen] = useState(null) // null = facts not loaded yet, so show nothing

      useEffect(() => {
        let alive = true
        api('/summary')
          .then(payload => { if (alive) setSeen(payload?.health?.onboardingSeen === true) })
          .catch(() => { if (alive) setSeen(false) })
        return () => { alive = false }
      }, [])

      /** Hand the step back: optionally persist "read" so it stays gone after a reload. */
      const dismiss = useCallback(markSeen => {
        setSeen(true)
        if (markSeen === true) api('/config', { method: 'POST', body: JSON.stringify({ patch: { onboarding: { seen: true } } }) }).catch(() => {})
        if (typeof complete === 'function') complete()
      }, [complete])

      // Explicitly requested onboarding ignores the "already read" flag; otherwise wait for the fact.
      if (explicit !== true && seen !== false) return null

      return h('div', { className: 'ad_ob' },
        h('div', { className: 'ad_obhead' }, h('span', { className: 'ad_obdot' }), h('h4', { className: 'ad_obtitle' }, t('obTitle'))),
        h('p', { className: 'ad_oblead' }, t('obLead')),
        h('ol', { className: 'ad_obsteps' }, ['guideS1', 'guideS2', 'guideS3', 'guideS4'].map((key, index) =>
          h('li', { key: key }, h('span', { className: 'ad_stepnum' }, String(index + 1)), h('span', null, t(key))))),
        h('div', { className: 'ad_obact' },
          h('button', {
            type: 'button',
            className: 'ad_btn primary',
            onClick: () => { if (typeof openSection === 'function') openSection('agent-dispatch'); dismiss(false) },
          }, t('obOpen')),
          h('button', { type: 'button', className: 'ad_btn', onClick: () => dismiss(true) }, t('obDone'))))
    }

    // ── Registration ─────────────────────────────────────────────────────────────────
    function apply(ctx) {
      const t = ctx.locale.bind(NS)
      ctx.effect(() => ctx.locale.register(NS, { zh: DICT.zh, en: DICT.en }), 'agent-dispatch: dictionaries')

      ctx.effect(() => {
        const style = document.createElement('style')
        style.setAttribute('data-plugin', 'dsh-agent-dispatch')
        style.textContent = CSS
        document.head.appendChild(style)
        return () => style.remove()
      }, 'agent-dispatch: styles')

      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'agent-dispatch',
        order: 40,
        label: () => t('nav'),
        locale: NS,
      }, props => h(Panel, { ...props, t })))

      // Onboarding card for first-time users: only appears when the host provides the settings.onboarding slot (its absence just means one fewer card).
      ctx.slots.inject('settings.onboarding', () => ctx.slots.register({
        name: 'settings.onboarding',
        id: 'agent-dispatch',
        order: -40,
        label: () => t('nav'),
        locale: NS,
      }, props => h(OnboardingCard, { ...props, t })))
    }

    exports.apply = apply
    exports.inject = inject
    exports.name = 'agent-dispatch'
    return module.exports
  },
})
