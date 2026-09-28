# Install

## Requirements

- DSH installed
- Node `^22.19.0 || >=24.0.0`

## Install (automatic)

Run the installer script:

```bash
node scripts/install-into-profile.mjs
```

The script prints a preview of the changes. To apply them:

```bash
node scripts/install-into-profile.mjs --apply
```

To revert:

```bash
node scripts/install-into-profile.mjs --revert
```

## Install (manual)

1. Add the plugin to your profile `package.json` dependencies:
   ```json
   "dsh-agent-dispatch": "link:D:/dsh-agent-dispatch"
   ```

2. Add `dsh-agent-dispatch` to the `dsh.profile.bundles` list in the same `package.json`.

## Restart DSH

The host half runs `apply()` once at startup, so a restart is required before the panel exists.

## Verify the install

- Open **Settings → 帮手调度 (Agent Dispatch)** in the DSH web GUI.
- Or from the local machine:
  ```bash
  curl http://127.0.0.1:3080/api/agent-dispatch/health
  ```

## Configure

1. Turn delegation on.
2. Pick helpers from the roster.
3. Set the concurrency cap (1–8) and step threshold.
4. Save — it takes effect on the next step.

## Uninstall

```bash
node scripts/install-into-profile.mjs --revert
```

Then restart DSH.

## Troubleshooting

| Symptom | Likely cause |
|---------|--------------|
| Panel missing | DSH was not restarted |
| Roster only shows built-in seed rows | No sibling lane plugin with `catalog.json` / `availability.json` |
| 403 on API call | Request did not come from loopback |
| Settings do not stick | Check write permissions on `$DSH_HOME/agent-dispatch` |