import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getResearchProvider, buildSearchQuery } from '@/lib/research'

/**
 * POST /api/sections/[id]/research — fetch 5 web_search results for this
 * section, optionally enrich the top 1-2 with page_reader content, and
 * persist them to the Research table (deleting any prior research rows for
 * the same section).
 *
 * Body (any subset):
 *   - query: string                  (optional — overrides buildSearchQuery)
 *   - num: number                    (optional — default 5)
 *   - fetchPages: boolean            (optional — default false; if true,
 *                                     fetch page_reader for the top 1-2 URLs
 *                                     and use that content as the snippet when
 *                                     the search snippet is empty)
 *
 * Returns:
 *   - { research, query } — the persisted research rows + the query used.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const section = await db.section.findUnique({
    where: { id },
    include: { article: { select: { topic: true } } },
  })
  if (!section) {
    return NextResponse.json({ error: 'Section not found' }, { status: 404 })
  }

  const query =
    typeof body?.query === 'string' && body.query.trim().length > 0
      ? body.query.trim()
      : buildSearchQuery({
          heading: section.heading,
          angle: section.angle,
          articleTopic: section.article.topic,
        })
  if (!query) {
    return NextResponse.json(
      { error: 'Could not build a search query — provide a section heading or article topic.' },
      { status: 400 },
    )
  }

  const num = typeof body?.num === 'number' && body.num > 0 ? Math.min(body.num, 10) : 5
  const fetchPages = Boolean(body?.fetchPages)

  const provider = getResearchProvider()
  const results = await provider.search(query, num)

  // Optionally enrich the top 1-2 results with full page content.
  if (fetchPages && results.length > 0) {
    const topN = Math.min(results.length, 2)
    const enriched: typeof results = []
    for (let i = 0; i < results.length; i++) {
      if (i < topN) {
        try {
          const pageContent = await provider.readPage(results[i].url)
          const clean = (pageContent || '').replace(/\s+/g, ' ').trim().slice(0, 400)
          enriched.push({
            ...results[i],
            snippet:
              results[i].snippet && results[i].snippet.length > 0
                ? results[i].snippet
                : clean,
          })
        } catch {
          enriched.push(results[i])
        }
      } else {
        enriched.push(results[i])
      }
    }
    results.splice(0, results.length, ...enriched)
  }

  // Wipe prior research rows and persist the new batch.
  await db.research.deleteMany({ where: { sectionId: id } })
  await db.research.createMany({
    data: results.map((r) => ({
      sectionId: id,
      query,
      title: r.title || r.url,
      url: r.url,
      snippet: r.snippet || '',
      publishedTime: r.publishedTime ?? null,
      favicon: r.favicon ?? null,
    })),
  })

  const saved = await db.research.findMany({
    where: { sectionId: id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ research: saved, query })
}
