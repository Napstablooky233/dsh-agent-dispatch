#!/usr/bin/env node
/**
 * Relative link and image check: scans all Markdown files in the repo,
 * verifying each relative path target actually exists.
 * External links (http/https/mailto) and pure anchors (#...) are skipped;
 * anchor/query string takes only the path portion before checking.
 * Purpose: the top language-switcher bar in the bilingual README references
 * repo-bundled SVGs; a wrong path silently shows a broken image—this layer catches that.
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
