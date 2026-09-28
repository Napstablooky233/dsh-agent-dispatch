/**
 * 把 dsh-agent-dispatch 装进 DSH profile（默认只预演，不落盘）。
 *
 *   node scripts/install-into-profile.mjs           # 预演：打印将要改的内容
 *   node scripts/install-into-profile.mjs --apply   # 真的改（自动备份）
 *   node scripts/install-into-profile.mjs --revert   # 撤回到上一次备份
 *
 * 只动一处文件：`<DSH_HOME>/profiles/<profile>/package.json` 的两行——
 * dependencies 里的 link: 依赖，和 dsh.profile.bundles 里的包名。
 * 改完需要 `pnpm install`（让 link: 生效）并重启 dsh（bundle 列表在启动时读）。
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const args = new Set(process.argv.slice(2))
const APPLY = args.has('--apply')
const REVERT = args.has('--revert')

const PACKAGE_NAME = 'dsh-agent-dispatch'
const SELF_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..')

const dshHome = process.env.DSH_HOME?.trim() || path.join(os.homedir(), '.dsh')
const profile = process.env.DSH_PROFILE?.trim() || 'web'
const profileDir = path.join(dshHome, 'profiles', profile)
const profilePkg = path.join(profileDir, 'package.json')
const backup = `${profilePkg}.agent-dispatch-backup`

function die(message) {
  console.error(`× ${message}`)
  process.exit(1)
}

if (!fs.existsSync(profilePkg)) die(`找不到 profile 清单：${profilePkg}`)

if (REVERT) {
  if (!fs.existsSync(backup)) die(`没有备份可撤回：${backup}`)
  fs.copyFileSync(backup, profilePkg)
  console.log(`✓ 已撤回：${profilePkg}\n  然后 pnpm install 并重启 dsh。`)
  process.exit(0)
}

const raw = fs.readFileSync(profilePkg, 'utf8')
const pkg = JSON.parse(raw)
pkg.dependencies ??= {}
pkg.dsh ??= {}
pkg.dsh.profile ??= {}
pkg.dsh.profile.bundles ??= []

const linkSpec = `link:${SELF_DIR.replace(/\\/g, '/')}`
const changes = []
if (pkg.dependencies[PACKAGE_NAME] !== linkSpec) changes.push(['dependencies', PACKAGE_NAME, pkg.dependencies[PACKAGE_NAME] ?? '(缺失)', linkSpec])
if (!pkg.dsh.profile.bundles.includes(PACKAGE_NAME)) changes.push(['dsh.profile.bundles', PACKAGE_NAME, '(缺失)', PACKAGE_NAME])

if (changes.length === 0) {
  console.log(`✓ ${PACKAGE_NAME} 已经在 profile 清单里，无需改动。`)
  console.log(`  插件目录：${SELF_DIR}`)
  process.exit(0)
}

console.log(`profile 清单：${profilePkg}`)
console.log(`插件目录    ：${SELF_DIR}\n`)
for (const [where, key, before, after] of changes) {
  console.log(`  ${where} · ${key}`)
  console.log(`    - ${before}`)
  console.log(`    + ${after}`)
}

if (!APPLY) {
  console.log('\n（预演模式，什么都没写。加 --apply 真的改。）')
  process.exit(0)
}

if (!fs.existsSync(backup)) fs.copyFileSync(profilePkg, backup)
pkg.dependencies[PACKAGE_NAME] = linkSpec
if (!pkg.dsh.profile.bundles.includes(PACKAGE_NAME)) pkg.dsh.profile.bundles.push(PACKAGE_NAME)
fs.writeFileSync(profilePkg, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8')

console.log(`\n✓ 已写入（备份：${backup}）`)
console.log('\n接下来：')
console.log(`  1) 建链接：pnpm install  （在 ${profileDir} 里跑）`)
console.log('  2) 重启 dsh')
console.log('  3) 设置 → 帮手调度')
console.log('\n撤回：node scripts/install-into-profile.mjs --revert')
