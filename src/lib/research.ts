/**
 * Research provider.
 *
 * Wraps the z-ai-web-dev-sdk's `functions.invoke('web_search', { query, num })`
 * and `functions.invoke('page_reader', { url })` calls behind a small
 * `ResearchProvider` interface so the implementation is pluggable. The
 * `ZaiProvider` issues real web search and page-reader calls; the
 * `MockProvider` is a deterministic offline fallback used when
 * `PKC_DISABLE_LLM=1` or when the SDK config is unavailable (e.g. in
 * `bun test`).
 *
 * The Mock provider still returns the requested number of results so the
 * UI stays demoable end-to-end offline.
 */

export interface ResearchInput {
  heading: string
  angle?: string | null
  articleTopic?: string | null
}

export interface WebSearchResult {
  title: string
  url: string
  snippet: string
  publishedTime?: string | null
  favicon?: string | null
}

export interface ResearchProvider {
  search(query: string, num?: number): Promise<WebSearchResult[]>
  readPage(url: string): Promise<string>
}

let cachedProvider: ResearchProvider | null = null

class ZaiProvider implements ResearchProvider {
  async search(query: string, num = 5): Promise<WebSearchResult[]> {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const res = await zai.functions.invoke('web_search', { query, num })
    // The SDK may return an array, an object with `results`, or an object
    // with `data`. Normalize defensively.
    const arr: any[] = Array.isArray(res)
      ? res
      : (res as any)?.results ?? (res as any)?.data ?? []
    return arr.slice(0, num).map((r: any) => ({
      title: r.title ?? r.name ?? r.heading ?? '',
      url: r.url ?? r.link ?? r.href ?? '',
      snippet: r.snippet ?? r.content ?? r.description ?? r.summary ?? '',
      publishedTime: r.publishedTime ?? r.date ?? r.published_at ?? null,
      favicon: r.favicon ?? r.icon ?? r.thumbnail ?? null,
    }))
  }

  async readPage(url: string): Promise<string> {
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const res = await zai.functions.invoke('page_reader', { url })
    if (typeof res === 'string') return res
    return (res as any)?.content ?? (res as any)?.text ?? (res as any)?.markdown ?? ''
  }
}

class MockProvider implements ResearchProvider {
  async search(query: string, num = 5): Promise<WebSearchResult[]> {
    const out: WebSearchResult[] = []
    const q = query || '(empty query)'
    for (let i = 0; i < num; i++) {
      out.push({
        title: `Mock result ${i + 1} for "${q}"`,
        url: `https://example.com/${i + 1}`,
        snippet:
          `This is a mock search-result snippet for query "${q}". The real ` +
          `z-ai-web-dev-sdk web_search function is disabled (PKC_DISABLE_LLM=1 ` +
          `or no SDK config). Result #${i + 1}.`,
        publishedTime: null,
        favicon: null,
      })
    }
    return out
  }

  async readPage(url: string): Promise<string> {
    return `Mock page content for ${url}. The real page_reader function is disabled.`
  }
}

export function getResearchProvider(): ResearchProvider {
  if (cachedProvider) return cachedProvider
  if (process.env.PKC_DISABLE_LLM === '1') {
    cachedProvider = new MockProvider()
    return cachedProvider
  }
  try {
    cachedProvider = new ZaiProvider()
  } catch (e) {
    console.warn(
      '[research] ZaiProvider unavailable, using MockProvider:',
      (e as Error).message,
    )
    cachedProvider = new MockProvider()
  }
  return cachedProvider
}

/** Test-only — inject or clear the provider. */
export function __setResearchProviderForTest(p: ResearchProvider | null) {
  cachedProvider = p
}

/**
 * Build a search query for a section.
 *
 * Strategy: combine the article topic and the section heading (and angle
 * if present) into a single space-separated query string. If both topic
 * and heading are missing, return an empty string (the route handler
 * decides what to do in that case).
 *
 * Examples:
 *   - topic="vector databases", heading="HNSW trade-offs"  -> "vector databases HNSW trade-offs"
 *   - heading="HNSW trade-offs", topic=null                  -> "HNSW trade-offs"
 *   - topic="vector databases", heading=null                -> "vector databases"
 *   - both empty                                              -> ""
 */
export function buildSearchQuery(section: ResearchInput): string {
  const topic = (section.articleTopic ?? '').trim()
  const heading = (section.heading ?? '').trim()
  const angle = (section.angle ?? '').trim()
  const parts: string[] = []
  if (topic.length > 0) parts.push(topic)
  if (heading.length > 0) parts.push(heading)
  if (angle.length > 0 && !heading.toLowerCase().includes(angle.toLowerCase())) {
    parts.push(angle)
  }
  return parts.join(' ').trim()
}
