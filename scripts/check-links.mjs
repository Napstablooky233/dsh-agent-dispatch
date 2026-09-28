#!/usr/bin/env node
/**
 * 相对链接与图片检查：扫描仓库内所有 Markdown，确认每个相对路径目标真实存在。
 * 外链（http/https/mailto）与纯锚点（#...）跳过；锚点/查询串只取路径部分再查。
 * 用途：双语 README 的顶部语言切换条引用仓库自带 SVG，路径写错时静默显示破图——这一层专门抓它。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['node_modules', '.git', '.agent-teams']);

function lineOf(text, index) {
  return text.slice(0, index).split('\n').length;
}

function collectMarkdown(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      collectMarkdown(path.join(dir, entry.name), out);
    } else if (entry.name.endsWith('.md')) {
      out.push(path.join(dir, entry.name));
    }
  }
  return out;
}

const mdFiles = collectMarkdown(root).sort();
const LINK_RE = /\]\(([^)\s]+)\)/g;
const SRC_RE = /\bsrc="([^"]+)"/g;
const EXTERNAL_RE = /^(https?:|mailto:|#)/i;

const problems = [];
let checked = 0;

for (const file of mdFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const rel = path.relative(root, file).split(path.sep).join('/');

  for (const re of [LINK_RE, SRC_RE]) {
    for (const match of text.matchAll(re)) {
      const raw = match[1];
      if (EXTERNAL_RE.test(raw)) continue;
      const target = raw.split('#')[0].split('?')[0];
      if (target === '') continue;
      checked++;
      const abs = path.resolve(path.dirname(file), decodeURI(target));
      if (!fs.existsSync(abs)) {
        problems.push(`${rel}:${lineOf(text, match.index)} → ${raw}`);
      }
    }
  }
}

if (problems.length > 0) {
  console.error('❌ 相对链接检查未通过，找不到目标：');
  for (const problem of problems) console.error(`   ${problem}`);
  console.error(`   总计 ${problems.length} 处`);
  process.exit(1);
}

console.log(`✅ 相对链接检查通过：${mdFiles.length} 个 Markdown，${checked} 个仓库内相对链接。`);
