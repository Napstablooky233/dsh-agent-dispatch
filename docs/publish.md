# Publish and Listing Runbook

Current state on this machine (verified 2026-09-28): DNS and HTTPS for `github.com`, `api.github.com`, and `registry.npmjs.org` all work; but `git credential.helper` is empty, `cmdkey` has no GitHub credentials, neither `~/.npmrc` nor `~/.git-credentials` exists, `GITHUB_TOKEN` / `GH_TOKEN` / `NPM_TOKEN` are not set, the `gh` CLI is not installed, and `~/.ssh` is empty.

**Conclusion: complete the steps that can be done locally now (already done). The steps that need credentials must be authorized by the repository owner.**

Status as of 2026-09-28: the repository is live at https://github.com/Napstablooky233/dsh-agent-dispatch (topics added, 24 files tracked); the remaining step is the pull request against `awesome-dsh-plugin`, which the age check opens up once the repository is 24 hours old.

## Local steps already completed

- `git init` plus the first commit (see `git log`).
- The listing entry has been written: `docs/awesome-dsh-plugin/Napstablooky233__dsh-agent-dispatch.yml`.
- Installation script, self-check, smoke, and i18n checks all pass.

## Steps requiring your authorization

### Step 1: push to your GitHub

```powershell
# When the repository does not exist yet, create an empty one on the GitHub website first (do not check README/.gitignore), then:
git -C D:\dsh-agent-dispatch remote add origin https://github.com/Napstablooky233/dsh-agent-dispatch.git
git -C D:\dsh-agent-dispatch push -u origin main
```

The first push will trigger Git Credential Manager browser authorization (or prompt for a PAT). After authorizing once, subsequent pushes will not require re-authentication.

### Step 2: add the `dsh-plugin` topic to the repository

The official requirement is that the repository has this topic. On the website: click the settings icon on the repository homepage (top right) → Topics → type `dsh-plugin` → Save.

With a PAT, one command also works:

```powershell
$h = @{ Authorization = "Bearer $env:GITHUB_TOKEN"; 'User-Agent' = 'dsh-agent-dispatch' }
Invoke-RestMethod -Method Put -Uri 'https://api.github.com/repos/Napstablooky233/dsh-agent-dispatch/topics' -Headers $h -ContentType 'application/json' -Body '{"names":["dsh-plugin","dsh"]}'
```

### Step 3: open a PR against `awesome-dsh-plugin`

```powershell
# fork and clone (forking on the web is easier)
git clone https://github.com/<your-username>/awesome-dsh-plugin
cd awesome-dsh-plugin
git checkout -b add-dsh-agent-dispatch
# Copy the file from this repository:
# docs/awesome-dsh-plugin/Napstablooky233__dsh-agent-dispatch.yml
# to this repository:
# data/plugins/Napstablooky233__dsh-agent-dispatch.yml
git add data/plugins/Napstablooky233__dsh-agent-dispatch.yml
git commit -m "Add Napstablooky233/dsh-agent-dispatch"
git push -u origin add-dsh-agent-dispatch
```

Then open a PR on the web against `awesome-dsh-plugin/awesome-dsh-plugin:main`.

> Note: the repository must be at least **1 day** old to pass CI. Opening a PR right after pushing will be blocked by the age check — either wait a day or push and wait for CI to re-run.

### Step 4 (optional): publish to npm

Does not affect listing, but provides a better installation experience (pre-built install avoids `allowBuilds` build authorization):

```powershell
npm login          # requires your browser authorization
npm publish        # the package name dsh-agent-dispatch is currently empty
```

## How to verify after listing

```powershell
# Check whether this plugin appears in the market data source
(Invoke-RestMethod https://awesome-dsh-plugin.com/plugins.json).plugins |
  Where-Object { $_.name -like '*agent-dispatch*' } | ConvertTo-Json -Depth 3
```

Once an entry appears, users can install it with one click in dsh-market, or directly:

```powershell
dsh plugin --profile web add Napstablooky233/dsh-agent-dispatch
```
