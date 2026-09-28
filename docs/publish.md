# 发布与上架 Runbook

本机现状（2026-09-28 实测）：`github.com` / `api.github.com` / `registry.npmjs.org` DNS 与 HTTPS **都通**；但 `git credential.helper` 为空、`cmdkey` 里没有 github 凭据、`~/.npmrc` 与 `~/.git-credentials` 都不存在、`GITHUB_TOKEN` / `GH_TOKEN` / `NPM_TOKEN` 都没设、`gh` CLI 未安装、`~/.ssh` 为空。

**结论：本地能做的一次性做完（已做），需要登录的两步必须由你本人授权。**

## 已完成的本地部分

- `git init` + 首次提交（见 `git log`）。
- 上架条目写好：`docs/awesome-dsh-plugin/Napstablooky233__dsh-agent-dispatch.yml`。
- 安装脚本、自检、冒烟、i18n 检查全绿。

## 需要你授权才能做的部分

### 第 1 步：推到你的 GitHub

```powershell
# 仓库还不存在时，先在 GitHub 网页建一个空仓库（不要勾 README/.gitignore），然后：
git -C D:\dsh-agent-dispatch remote add origin https://github.com/Napstablooky233/dsh-agent-dispatch.git
git -C D:\dsh-agent-dispatch push -u origin main
```

首次 push 会弹 Git Credential Manager 的浏览器授权（或让你填 PAT）。授权一次后，之后的 push 就不用再登。

### 第 2 步：给仓库加 `dsh-plugin` topic

官方要求仓库带这个 topic。网页：仓库首页右上 `⚙` → Topics → 填 `dsh-plugin` → Save。
有 PAT 时也可以一条命令：

```powershell
$h = @{ Authorization = "Bearer $env:GITHUB_TOKEN"; 'User-Agent' = 'dsh-agent-dispatch' }
Invoke-RestMethod -Method Put -Uri 'https://api.github.com/repos/Napstablooky233/dsh-agent-dispatch/topics' -Headers $h -ContentType 'application/json' -Body '{"names":["dsh-plugin","dsh"]}'
```

### 第 3 步：向 awesome-dsh-plugin 提 PR

```powershell
# fork + clone（网页 fork 更省事）
git clone https://github.com/<你的用户名>/awesome-dsh-plugin
cd awesome-dsh-plugin
git checkout -b add-dsh-agent-dispatch
# 把本仓库的 docs/awesome-dsh-plugin/Napstablooky233__dsh-agent-dispatch.yml
# 复制到本仓库的 data/plugins/Napstablooky233__dsh-agent-dispatch.yml
git add data/plugins/Napstablooky233__dsh-agent-dispatch.yml
git commit -m "Add Napstablooky233/dsh-agent-dispatch"
git push -u origin add-dsh-agent-dispatch
```

然后在网页上向 `awesome-dsh-plugin/awesome-dsh-plugin:main` 开 PR。

> ⚠️ 仓库至少满 **1 天**才能过 CI。刚 push 就提 PR 会被年龄检查挡下——等一天再提，或提了等 CI 重跑。

### 第 4 步（可选）：发 npm

不影响收录，只为更好的安装体验（预构建安装免 `allowBuilds` 构建授权）：

```powershell
npm login          # 需要你本人浏览器授权
npm publish        # 包名 dsh-agent-dispatch 当前为空
```

## 上架后怎么验证

```powershell
# 市场数据源里是否出现本插件
(Invoke-RestMethod https://awesome-dsh-plugin.com/plugins.json).plugins |
  Where-Object { $_.name -like '*agent-dispatch*' } | ConvertTo-Json -Depth 3
```

出现条目后，用户即可在 dsh-market 里一键安装，或直接：

```powershell
dsh plugin --profile web add Napstablooky233/dsh-agent-dispatch
```
