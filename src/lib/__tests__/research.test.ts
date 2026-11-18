import { test, expect, describe } from 'bun:test'
import {
  buildSearchQuery,
  getResearchProvider,
  __setResearchProviderForTest,
  type ResearchProvider,
} from '../research'

describe('buildSearchQuery', () => {
  test('combines topic + heading', () => {
    const q = buildSearchQuery({
      heading: 'HNSW trade-offs',
      articleTopic: 'vector databases',
    })
    expect(q).toBe('vector databases HNSW trade-offs')
  })
  test('heading only (no topic)', () => {
    expect(
      buildSearchQuery({ heading: 'HNSW trade-offs', articleTopic: null }),
    ).toBe('HNSW trade-offs')
  })
  test('topic only (no heading)', () => {
    expect(
      buildSearchQuery({ heading: '', articleTopic: 'vector databases' }),
    ).toBe('vector databases')
  })
  test('both empty -> empty string', () => {
    expect(buildSearchQuery({ heading: '', articleTopic: null })).toBe('')
  })
  test('whitespace is trimmed', () => {
    expect(
      buildSearchQuery({
        heading: '  HNSW  ',
        articleTopic: '  vector databases  ',
      }),
    ).toBe('vector databases HNSW')
  })
  test('angle is appended when provided and not already in heading', () => {
    const q = buildSearchQuery({
      heading: 'Trade-offs',
      angle: 'memory cost',
      articleTopic: null,
    })
    expect(q).toBe('Trade-offs memory cost')
  })
  test('angle is NOT appended if it duplicates the heading', () => {
    const q = buildSearchQuery({
      heading: 'HNSW trade-offs focus on memory',
      angle: 'memory',
      articleTopic: null,
    })
    expect(q).toBe('HNSW trade-offs focus on memory')
  })
  test('null angle is treated like empty', () => {
    expect(
      buildSearchQuery({ heading: 'HNSW', angle: null, articleTopic: null }),
    ).toBe('HNSW')
  })
})

describe('ResearchProvider (mock)', () => {
  class MockResearch implements ResearchProvider {
    async search(query: string, num = 5) {
      const out = []
      for (let i = 0; i < num; i++) {
        out.push({
          title: `Result ${i + 1} for ${query}`,
          url: `https://example.com/${i + 1}`,
          snippet: `snip ${i + 1}`,
          publishedTime: null,
          favicon: null,
        })
      }
      return out
    }
    async readPage(url: string) {
      return `page content for ${url}`
    }
  }

  test('search returns the requested number of results', async () => {
    __setResearchProviderForTest(new MockResearch())
    const p = getResearchProvider()
    const results = await p.search('test query', 5)
    expect(results).toHaveLength(5)
    expect(results[0].title).toContain('test query')
    __setResearchProviderForTest(null)
  })

  test('search respects num parameter', async () => {
    __setResearchProviderForTest(new MockResearch())
    const p = getResearchProvider()
    const results = await p.search('test', 3)
    expect(results).toHaveLength(3)
    __setResearchProviderForTest(null)
  })

  test('readPage returns content for a URL', async () => {
    __setResearchProviderForTest(new MockResearch())
    const p = getResearchProvider()
    const content = await p.readPage('https://example.com')
    expect(content).toContain('example.com')
    __setResearchProviderForTest(null)
  })

  test('getResearchProvider returns the same instance on repeated calls', () => {
    __setResearchProviderForTest(new MockResearch())
    const a = getResearchProvider()
    const b = getResearchProvider()
    expect(a).toBe(b)
    __setResearchProviderForTest(null)
  })
})
