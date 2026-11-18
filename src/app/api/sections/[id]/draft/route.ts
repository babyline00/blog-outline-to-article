import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDraftProvider, buildSectionDraftPrompt } from '@/lib/ai'
import { getTonePreset, DEFAULT_TONE } from '@/lib/tone-presets'
import { extractCitationMarkers } from '@/lib/citation-extractor'

/**
 * POST /api/sections/[id]/draft — generate a fresh draft for this section
 * using the section's persisted Research rows, then persist it as a new
 * SectionVersion and point the section's currentDraftId at it.
 *
 * Body (any subset):
 *   - tonePreset: ToneName            (optional — overrides article.tone for this draft)
 *   - useExistingResearch: boolean    (optional — default true; if false, the
 *                                      caller is expected to refresh research
 *                                      separately before drafting)
 *
 * Returns:
 *   - { version, citations } — the new SectionVersion + the deduped citation
 *     metadata array (also persisted as SectionVersion.citations JSON).
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const section = await db.section.findUnique({
    where: { id },
    include: {
      article: true,
      research: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (!section) {
    return NextResponse.json({ error: 'Section not found' }, { status: 404 })
  }

  const requestedTone =
    typeof body?.tonePreset === 'string' ? body.tonePreset : section.article.tone
  const tone = getTonePreset(requestedTone) ?? getTonePreset(DEFAULT_TONE)!
  const useExisting = body?.useExistingResearch !== false
  const research = useExisting ? section.research : []

  const { systemPrompt, userPrompt } = buildSectionDraftPrompt({
    heading: section.heading,
    angle: section.angle,
    articleTitle: section.article.title,
    articleTopic: section.article.topic,
    tone,
    research: research.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      publishedTime: r.publishedTime,
    })),
  })

  const provider = getDraftProvider()
  const content = await provider.complete({ systemPrompt, userPrompt })

  // Map the LLM's [^cN] markers back to the Research rows (1-indexed), dedup
  // by researchId while preserving the order of first appearance. This array
  // is persisted as SectionVersion.citations JSON so the export step can
  // re-hydrate footnotes even if the Research rows are later regenerated.
  const markers = extractCitationMarkers(content)
  const citedResearch = markers
    .map((m) => research[m.ordinal - 1])
    .filter((r) => Boolean(r))
    .map((r) => ({
      researchId: r.id,
      title: r.title,
      url: r.url,
      snippet: r.snippet,
      publishedTime: r.publishedTime ?? undefined,
    }))
  const seen = new Set<string>()
  const uniqueCited = citedResearch.filter((c) => {
    if (seen.has(c.researchId)) return false
    seen.add(c.researchId)
    return true
  })

  const version = await db.sectionVersion.create({
    data: {
      sectionId: id,
      content,
      citations: JSON.stringify(uniqueCited),
    },
  })
  await db.section.update({
    where: { id },
    data: { currentDraftId: version.id },
  })

  return NextResponse.json({ version, citations: uniqueCited })
}
