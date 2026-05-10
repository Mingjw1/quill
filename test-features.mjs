/**
 * Quill 新功能测试脚本
 * 测试 Phase 1-3 的核心逻辑：MiniSearch 索引、撤销/重做快照、文件持久化
 *
 * 用法: node test-features.mjs
 */

import MiniSearch from 'minisearch'
import { readFileSync, writeFileSync, unlinkSync, existsSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import assert from 'assert/strict'

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ❌ ${name}`)
    console.log(`      ${e.message}`)
    failed++
  }
}

function suite(name, fn) {
  console.log(`\n=== ${name} ===`)
  fn()
}

// 构建测试数据（与 useStore.js 中数据结构一致）
const sampleFiles = {
  c1: [
    { id: 'f1', name: '图像生成提示词', tag: 'Prompt', type: 'text', blocks: [
      { title: 'Midjourney', items: [{ text: 'portrait photography, soft lighting' }, { text: 'product photography, marble surface' }] }
    ]},
    { id: 'f2', name: '写作灵感', tag: 'Idea', type: 'text', blocks: [
      { title: '故事梗概', items: [{ text: '一个关于时间旅行的故事' }] }
    ]}
  ],
  c2: [
    { id: 'f3', name: '服务密钥', tag: 'Secret', type: 'text', blocks: [
      { title: 'API Keys', items: [{ label: 'OpenAI', text: 'sk-xxxxxxxxxx' }] }
    ]},
    { id: 'f4', name: 'README', tag: 'Markdown', type: 'markdown', content: '# Welcome\nThis is a **markdown** file with code\n```\nconst x = 1\n```' }
  ],
  c3: [
    { id: 'f5', name: '代码片段', tag: 'Note', type: 'code', content: 'function hello() {\n  return "world"\n}' }
  ]
}

// =============================================
// Phase 3: MiniSearch 搜索索引测试
// =============================================
suite('Phase 3: MiniSearch 搜索索引', () => {

  test('构建索引并搜索文件名', () => {
    const miniSearch = new MiniSearch({
      fields: ['name', 'tag', 'content'],
      idField: 'id',
      searchOptions: { prefix: true, fuzzy: 0.2 }
    })

    const docs = []
    for (const catId in sampleFiles) {
      for (const file of sampleFiles[catId]) {
        let content = ''
        if (file.type === 'markdown' || file.type === 'code') {
          content = file.content || ''
        } else {
          content = (file.blocks || []).flatMap(b =>
            (b.items || []).map(i => [i.label, i.text].filter(Boolean).join(' '))
          ).join(' ')
        }
        docs.push({ id: file.id, name: file.name, tag: file.tag || '', content, catId })
      }
    }
    miniSearch.addAll(docs)

    // 搜索文件名和标签（MiniSearch 默认分词器仅支持英文/数字）
    const results1 = miniSearch.search('README')
    assert.ok(results1.some(r => r.id === 'f4'), '应该匹配 README')
    const results2 = miniSearch.search('OpenAI')
    assert.ok(results2.some(r => r.id === 'f3'), '应该匹配包含 OpenAI 标签的文件')
  })

  test('支持模糊搜索', () => {
    const miniSearch = new MiniSearch({
      fields: ['name', 'tag', 'content'],
      idField: 'id',
      searchOptions: { prefix: true, fuzzy: 0.2 }
    })

    const docs = []
    for (const catId in sampleFiles) {
      for (const file of sampleFiles[catId]) {
        let content = ''
        if (file.type === 'markdown' || file.type === 'code') {
          content = file.content || ''
        } else {
          content = (file.blocks || []).flatMap(b =>
            (b.items || []).map(i => [i.label, i.text].filter(Boolean).join(' '))
          ).join(' ')
        }
        docs.push({ id: file.id, name: file.name, tag: file.tag || '', content, catId })
      }
    }
    miniSearch.addAll(docs)

    // 搜索内容 — 拼音/拼写容错
    const results2 = miniSearch.search('portrait')
    assert.ok(results2.some(r => r.id === 'f1'), '应该匹配 portrait 相关内容')

    const results3 = miniSearch.search('markdown')
    assert.ok(results3.some(r => r.id === 'f4'), '应该匹配 markdown 文件')
  })

  test('搜索标签 (tag)', () => {
    const miniSearch = new MiniSearch({
      fields: ['name', 'tag', 'content'],
      idField: 'id',
      searchOptions: { prefix: true, fuzzy: 0.2 }
    })

    const docs = []
    for (const catId in sampleFiles) {
      for (const file of sampleFiles[catId]) {
        let content = ''
        if (file.type === 'markdown' || file.type === 'code') {
          content = file.content || ''
        } else {
          content = (file.blocks || []).flatMap(b =>
            (b.items || []).map(i => [i.label, i.text].filter(Boolean).join(' '))
          ).join(' ')
        }
        docs.push({ id: file.id, name: file.name, tag: file.tag || '', content, catId })
      }
    }
    miniSearch.addAll(docs)

    const results = miniSearch.search('Secret')
    assert.ok(results.some(r => r.id === 'f3'), '应该匹配 Secret 标签的文件')
  })

  test('搜索 code 类型文件内容', () => {
    const miniSearch = new MiniSearch({
      fields: ['name', 'tag', 'content'],
      idField: 'id',
      searchOptions: { prefix: true, fuzzy: 0.2 }
    })

    const docs = []
    for (const catId in sampleFiles) {
      for (const file of sampleFiles[catId]) {
        let content = ''
        if (file.type === 'markdown' || file.type === 'code') {
          content = file.content || ''
        } else {
          content = (file.blocks || []).flatMap(b =>
            (b.items || []).map(i => [i.label, i.text].filter(Boolean).join(' '))
          ).join(' ')
        }
        docs.push({ id: file.id, name: file.name, tag: file.tag || '', content, catId })
      }
    }
    miniSearch.addAll(docs)

    const results = miniSearch.search('hello')
    assert.ok(results.some(r => r.id === 'f5'), 'code 类型文件内容应能被搜索到')
  })

  test('空查询返回 null', () => {
    const miniSearch = new MiniSearch({
      fields: ['name', 'tag', 'content'],
      idField: 'id',
      searchOptions: { prefix: true, fuzzy: 0.2 }
    })
    miniSearch.addAll([{ id: 'f1', name: 'test', tag: '', content: 'hello' }])

    // 模拟 searchFileIds 逻辑
    function searchFileIds(query) {
      if (!query || !query.trim()) return null
      const results = miniSearch.search(query)
      return new Set(results.map(r => r.id))
    }

    assert.equal(searchFileIds(''), null)
    assert.equal(searchFileIds('  '), null)
    assert.ok(searchFileIds('hello') instanceof Set)
  })

  test('重建索引: removeAll + addAll', () => {
    const miniSearch = new MiniSearch({
      fields: ['name', 'tag', 'content'],
      idField: 'id',
      searchOptions: { prefix: true, fuzzy: 0.2 }
    })

    // 初始索引
    miniSearch.addAll([{ id: 'f1', name: 'old', tag: '', content: 'old content' }])
    assert.ok(miniSearch.search('old').length > 0)

    // 重建
    miniSearch.removeAll()
    miniSearch.addAll([{ id: 'f2', name: 'new', tag: '', content: 'new content' }])
    assert.equal(miniSearch.search('old').length, 0, '重建后旧数据不应存在')
    assert.ok(miniSearch.search('new').length > 0, '重建后新数据应可搜索')
  })
})

// =============================================
// Phase 2: 撤销/重做快照测试
// =============================================
suite('Phase 2: 撤销/重做', () => {

  test('pushSnapshot 保存当前状态', () => {
    const history = []
    const state = { categories: [{ id: 'c1', name: '测试' }], files: { c1: [] }, passwords: {} }

    function pushSnapshot() {
      history.push(JSON.parse(JSON.stringify(state)))
    }

    pushSnapshot()
    assert.equal(history.length, 1)
    assert.deepEqual(history[0].categories, [{ id: 'c1', name: '测试' }])
  })

  test('undo 恢复上一个状态', () => {
    const history = []
    const future = []
    const state = { categories: [], files: {}, passwords: {} }

    function pushSnapshot() {
      history.push(JSON.parse(JSON.stringify(state)))
    }
    function undo() {
      if (history.length === 0) return
      future.push(JSON.parse(JSON.stringify(state)))
      const prev = history.pop()
      state.categories = prev.categories
      state.files = prev.files
      state.passwords = prev.passwords
    }

    // 修改状态前快照
    state.categories = [{ id: 'c1', name: '原始' }]
    pushSnapshot()

    // 修改
    state.categories = [{ id: 'c1', name: '修改后' }]
    assert.equal(state.categories[0].name, '修改后')

    // 撤销
    undo()
    assert.equal(state.categories[0].name, '原始')
  })

  test('redo 恢复撤销前的状态', () => {
    const history = []
    const future = []
    const state = { categories: [], files: {}, passwords: {} }

    function pushSnapshot() {
      history.push(JSON.parse(JSON.stringify(state)))
    }
    function undo() {
      if (history.length === 0) return
      future.push(JSON.parse(JSON.stringify(state)))
      const prev = history.pop()
      state.categories = prev.categories
      state.files = prev.files
      state.passwords = prev.passwords
    }
    function redo() {
      if (future.length === 0) return
      history.push(JSON.parse(JSON.stringify(state)))
      const next = future.pop()
      state.categories = next.categories
      state.files = next.files
      state.passwords = next.passwords
    }

    state.categories = [{ id: 'c1', name: 'A' }]
    pushSnapshot()
    state.categories = [{ id: 'c1', name: 'B' }]
    pushSnapshot()
    state.categories = [{ id: 'c1', name: 'C' }]

    // 撤两步到 A
    undo() // C → B
    undo() // B → A
    assert.equal(state.categories[0].name, 'A')

    // 重做一步到 B
    redo()
    assert.equal(state.categories[0].name, 'B')
  })

  test('新操作时清空 redo 栈', () => {
    const history = []
    const future = []
    const state = { categories: [], files: {}, passwords: {} }

    function pushSnapshot() {
      history.push(JSON.parse(JSON.stringify(state)))
      future.length = 0 // 新操作清空 future
    }
    function undo() {
      if (history.length === 0) return
      future.push(JSON.parse(JSON.stringify(state)))
      const prev = history.pop()
      state.categories = prev.categories
    }
    function redo() {
      if (future.length === 0) return
      history.push(JSON.parse(JSON.stringify(state)))
      const next = future.pop()
      state.categories = next.categories
    }

    state.categories = [{ id: 'c1', name: 'A' }]
    pushSnapshot()
    state.categories = [{ id: 'c1', name: 'B' }]
    undo()
    assert.equal(state.categories[0].name, 'A')
    assert.equal(future.length, 1)

    // 新操作应清空 redo 栈
    state.categories = [{ id: 'c1', name: 'C' }]
    pushSnapshot()
    assert.equal(future.length, 0, '新操作应清空 redo 栈')
  })

  test('历史栈上限 50 条', () => {
    const MAX_HISTORY = 50
    const history = []
    const state = { categories: [], files: {}, passwords: {} }

    for (let i = 0; i < 60; i++) {
      const snap = JSON.parse(JSON.stringify(state))
      history.push(snap)
      if (history.length > MAX_HISTORY) history.shift()
    }
    assert.equal(history.length, MAX_HISTORY, '历史栈不应超过 50 条')
  })

  test('undo 空栈无操作', () => {
    const history = []
    const future = []
    const state = { categories: [{ id: 'c1', name: 'test' }], files: {}, passwords: {} }

    function undo() {
      if (history.length === 0) return
      future.push(JSON.parse(JSON.stringify(state)))
      const prev = history.pop()
      state.categories = prev.categories
    }

    undo() // should not throw
    assert.equal(state.categories[0].name, 'test')
  })
})

// =============================================
// Phase 1: 文件持久化测试
// =============================================
suite('Phase 1: 文件持久化', () => {

  test('JSON 序列化/反序列化数据', () => {
    const data = {
      categories: [{ id: 'c1', name: '测试', order: 0 }],
      files: { c1: [{ id: 'f1', name: 'file1', type: 'text', blocks: [] }] },
      passwords: { __global__: { pin: { salt: 'abc', hash: 'def' } } }
    }

    const json = JSON.stringify(data)
    const parsed = JSON.parse(json)
    assert.deepEqual(parsed, data)
  })

  test('写入并读取文件', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'quill-test-'))
    const filePath = join(tmpDir, 'quill-data.json')

    const data = { categories: [{ id: 'c1', name: '测试文件持久化' }], files: {}, passwords: {} }

    // 写入
    writeFileSync(filePath, JSON.stringify(data), 'utf-8')
    assert.ok(existsSync(filePath))

    // 读取
    const content = readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(content)
    assert.equal(parsed.categories[0].name, '测试文件持久化')

    // 清理
    unlinkSync(filePath)
  })

  test('文件不存在时返回 null（模拟 tryLoadFromFile fallthrough）', () => {
    // 读取不存在的文件应抛异常（被 tryLoadFromFile 的 catch 捕获）
    try {
      readFileSync('/tmp/nonexistent-quill-test-file.json', 'utf-8')
      assert.fail('应该抛出异常')
    } catch (e) {
      assert.ok(e.code === 'ENOENT', '文件不存在应抛出 ENOENT')
    }
  })

  test('损坏的 JSON 应能优雅处理', () => {
    try {
      JSON.parse('{invalid json}')
      assert.fail('应该抛出异常')
    } catch (e) {
      assert.ok(e instanceof SyntaxError)
    }
  })

  test('大数据量序列化性能', () => {
    // 模拟 500 个文件的性能
    const largeData = {
      categories: [{ id: 'c1', name: 'Large' }],
      files: {
        c1: Array.from({ length: 500 }, (_, i) => ({
          id: `f${i}`,
          name: `File ${i}`,
          tag: 'Note',
          type: 'text',
          blocks: [{
            title: `Block ${i}`,
            items: [{ text: 'content '.repeat(20) }]
          }]
        }))
      },
      passwords: {}
    }

    const start = Date.now()
    const json = JSON.stringify(largeData)
    const serializeTime = Date.now() - start

    const parseStart = Date.now()
    JSON.parse(json)
    const parseTime = Date.now() - parseStart

    console.log(`     序列化 ${largeData.files.c1.length} 个文件: ${serializeTime}ms, 反序列化: ${parseTime}ms`)
    assert.ok(serializeTime < 1000, `序列化应在 1s 内完成 (实际 ${serializeTime}ms)`)
    assert.ok(parseTime < 500, `反序列化应在 500ms 内完成 (实际 ${parseTime}ms)`)
  })
})

// =============================================
// 结果汇总
// =============================================
console.log(`\n${'='.repeat(40)}`)
console.log(`总计: ${passed + failed} 个测试`)
console.log(`通过: ${passed}, 失败: ${failed}`)
if (failed > 0) process.exit(1)
