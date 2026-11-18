import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { parseOutline } from '@/lib/outline-parser'
import { TONE_NAMES, DEFAULT_TONE } from '@/lib/tone-presets'

/**
 * GET /api/articles — list all articles (newest first), with section counts.
 *
 * Query params:
 *   - status: "draft" | "published" | "all" (default "all")
 */
export async function GET(req: NextRequest) {
  const status = req.nextUrl.searchParams.get('status') ?? 'all'
  const where = status === 'all' ? {} : { status }
  const articles = await db.article.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { sections: true } } },
  })
  return NextResponse.json({ articles })
}

/**
 * POST /api/articles — create a new article.
 *
 * Body:
 *   - title: string                 (optional — falls back to first outline line)
 *   - outline: string               (optional multi-line text — parsed into sections)
 *   - sections: ParsedSection[]     (optional explicit section list, overrides outline)
 *   - topic: string                 (optional)
 *   - tone: ToneName                (optional — defaults to "informative")
 *   - tags: string                  (optional comma-separated)
 *
 * Returns the created article with its sections.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const outlineText = typeof body?.outline === 'string' ? body.outline : ''
  const parsed = parseOutline(outlineText)
  const explicitTitle = typeof body?.title === 'string' ? body.title.trim() : ''
  const finalTitle =
    explicitTitle || parsed.title || 'Untitled Article'

  const sectionsInput =
    Array.isArray(body?.sections) && body.sections.length > 0
      ? body.sections
      : parsed.sections

  const requestedTone = typeof body?.tone === 'string' ? body.tone : DEFAULT_TONE
  const tone = (TONE_NAMES as string[]).includes(requestedTone)
    ? requestedTone
    : DEFAULT_TONE

  const tags = typeof body?.tags === 'string' ? body.tags : ''
  const topic = typeof body?.topic === 'string' && body.topic.trim().length > 0
    ? body.topic.trim()
    : null

  const article = await db.article.create({
    data: {
      title: finalTitle,
      topic,
      tone,
      tags,
      status: 'draft',
      sections: {
        create: sectionsInput.map(
          (s: { heading?: string; angle?: string }, i: number) => ({
            ordinal: i,
            heading: (s?.heading ?? '').toString().trim() || `Section ${i + 1}`,
            angle: s?.angle ? s.angle.toString().trim() : null,
          }),
        ),
      },
    },
    include: { sections: { orderBy: { ordinal: 'asc' } } },
  })
  return NextResponse.json({ article }, { status: 201 })
}
