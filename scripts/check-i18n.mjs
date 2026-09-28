/**
 * dsh-agent-dispatch 文案一致性守卫。
 * 读 client.js 的 DICT，断言 zh/en 键名完全相同、无重复键、所有 t() 调用的键都在字典里。
 * 跑法：node D:\dsh-agent-dispatch\scripts\check-i18n.mjs
 */

import fs from 'node:fs'
import path from 'node:path'

const clientPath = path.join('D:', 'dsh-agent-dispatch', 'client.js')
const content = fs.readFileSync(clientPath, 'utf8')

// 提取 DICT 对象：从 "const DICT = {" 找到匹配的 "};"
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

// 1. 检查 zh/en 键名完全相同
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

// 2. 检查同一个字典里没有重复键
const zhDup = zhKeys.filter((k, i) => zhKeys.indexOf(k) !== i)
const enDup = enKeys.filter((k, i) => enKeys.indexOf(k) !== i)
if (zhDup.length > 0) {
  errors.push(`zh 有重复键: ${zhDup.join(', ')}`)
}
if (enDup.length > 0) {
  errors.push(`en 有重复键: ${enDup.join(', ')}`)
}

// 3. 提取所有 t() 调用的键
// 模式：t('key') 或 t("key") — 单/双引号字符串字面量（不含模板字面量）
// 先排除 t(`...`) 这种模板字面量，因为里面可能有 ${...} 不是字典键
// 前面必须不是标识符字符（否则 createElement('style') 会被误判成 t('style')）
const tCalls = [...content.matchAll(/(^|[^\w.$])t\((['"])([^'"\n]+)\2\)/g)].map(m => m[3])

// 去重
const usedKeys = [...new Set(tCalls)]

// 检查每个用到的键是否在 zh 字典里
const dictKeys = new Set(zhKeys)
const missingKeys = usedKeys.filter(k => !dictKeys.has(k))
if (missingKeys.length > 0) {
  errors.push(`代码里引用但字典里找不到的键 (${missingKeys.length} 个): ${missingKeys.join(', ')}`)
}

// 输出结果
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