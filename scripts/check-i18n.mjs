/**
 * dsh-agent-dispatch i18n consistency guard.
 * Reads client.js's DICT, asserts zh/en keys are identical, no duplicate keys,
 * and all keys referenced in t() calls exist in the dictionary.
 * Run: node D:\dsh-agent-dispatch\scripts\check-i18n.mjs
 */

import fs from 'node:fs'
import path from 'node:path'

const clientPath = path.join('D:', 'dsh-agent-dispatch', 'client.js')
const content = fs.readFileSync(clientPath, 'utf8')

// Extract the DICT object: find the matching "};" from "const DICT = {"
function extractDictObject(text) {
  const start = text.indexOf('const DICT = {')
  if (start === -1) return null
  
  let braceCount = 0
  let inString = false
  let stringChar = ''
  let escaped = false
  let i = start
  
  for (; i < text.length; i++) {
    const ch = text[i]
    
    if (inString) {
      if (escaped) {
        escaped = false
      } else if (ch === '\\') {
        escaped = true
      } else if (ch === stringChar) {
        inString = false
      }
    } else {
      if (ch === '"' || ch === "'" || ch === '`') {
        inString = true
        stringChar = ch
      } else if (ch === '{') {
        braceCount++
      } else if (ch === '}') {
        braceCount--
        if (braceCount === 0) {
          const objStart = text.indexOf('{', start)
          return text.slice(objStart, i + 1)
        }
      }
    }
  }
  return null
}

const dictCode = extractDictObject(content)
if (!dictCode) {
  console.error('❌ 找不到 DICT 定义')
  process.exit(1)
}

let DICT
try {
  // eslint-disable-next-line no-new-func
  DICT = new Function('return ' + dictCode)()
} catch (e) {
  console.error('❌ DICT 解析失败:', e.message)
  process.exit(1)
}

const zhKeys = Object.keys(DICT.zh ?? {})
const enKeys = Object.keys(DICT.en ?? {})

let errors = []

// 1. Check zh/en keys are identical
const zhSet = new Set(zhKeys)
const enSet = new Set(enKeys)

const missingInEn = zhKeys.filter(k => !enSet.has(k))
const missingInZh = enKeys.filter(k => !zhSet.has(k))

if (missingInEn.length > 0) {
  errors.push(`en 缺少 ${missingInEn.length} 个键: ${missingInEn.join(', ')}`)
}
if (missingInZh.length > 0) {
  errors.push(`zh 缺少 ${missingInZh.length} 个键: ${missingInZh.join(', ')}`)
}

// 2. Check no duplicate keys within the same dictionary
const zhDup = zhKeys.filter((k, i) => zhKeys.indexOf(k) !== i)
const enDup = enKeys.filter((k, i) => enKeys.indexOf(k) !== i)
if (zhDup.length > 0) {
  errors.push(`zh 有重复键: ${zhDup.join(', ')}`)
}
if (enDup.length > 0) {
  errors.push(`en 有重复键: ${enDup.join(', ')}`)
}

// 3. Extract all keys referenced in t() calls
// Pattern: t('key') or t("key") — single/double-quoted string literals (not template literals)
// Exclude t(`...`) template literals first, since they may contain ${...} that isn't a dict key
// Must not be preceded by an identifier character (otherwise createElement('style') would be misdetected as t('style'))
const tCalls = [...content.matchAll(/(^|[^\w.$])t\((['"])([^'"\n]+)\2\)/g)].map(m => m[3])

// Deduplicate
const usedKeys = [...new Set(tCalls)]

// Check whether each used key exists in the zh dictionary
const dictKeys = new Set(zhKeys)
const missingKeys = usedKeys.filter(k => !dictKeys.has(k))
if (missingKeys.length > 0) {
  errors.push(`代码里引用但字典里找不到的键 (${missingKeys.length} 个): ${missingKeys.join(', ')}`)
}

// Output results
if (errors.length === 0) {
  console.log(`✅ i18n 检查通过：zh/en 共 ${zhKeys.length} 个键，代码引用 ${usedKeys.length} 个键，全部在字典中`)
  process.exit(0)
} else {
  console.error('❌ i18n 检查失败：')
  for (const err of errors) {
    console.error('  - ' + err)
  }
  process.exit(1)
}