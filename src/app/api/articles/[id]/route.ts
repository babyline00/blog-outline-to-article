import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TONE_NAMES } from '@/lib/tone-presets'

interface ArticleFull {
  id: string
  title: string
  topic: string | null
  tone: string
  tags: string
  status: string
  createdAt: Date
  updatedAt: Date
  sections: Array<{
    id: string
    articleId: string
    ordinal: number
    heading: string
    angle: string | null
    currentDraftId: string | null
    currentDraft: { id: string; content: string; citations: string; createdAt: Date } | null
    research: Array<{
      id: string
      query: string
      title: string
      url: string
      snippet: string
      publishedTime: string | null
      favicon: string | null
      createdAt: Date
    }>
    _count: { versions: number }
  }>
}

/** GET /api/articles/[id] — full article with sections, current drafts, and research. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const article = await db.article.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { ordinal: 'asc' },
        include: {
          currentDraft: true,
          research: { orderBy: { createdAt: 'asc' } },
          _count: { select: { versions: true } },
        },
      },
    },
  })
  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }
  return NextResponse.json({ article: article as unknown as ArticleFull })
}

/**
 * PATCH /api/articles/[id] — update title / topic / tone / tags / status.
 *
 * Body (any subset):
 *   - title: string
 *   - topic: string | null
 *   - tone: ToneName
 *   - tags: string
 *   - status: "draft" | "published"
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const data: Record<string, unknown> = {}
  if (typeof body?.title === 'string' && body.title.trim().length > 0) {
    data.title = body.title.trim()
  }
  if (typeof body?.topic === 'string') {
    data.topic = body.topic.trim().length > 0 ? body.topic.trim() : null
  }
  if (typeof body?.tone === 'string' && (TONE_NAMES as string[]).includes(body.tone)) {
    data.tone = body.tone
  }
  if (typeof body?.tags === 'string') {
    data.tags = body.tags
  }
  if (typeof body?.status === 'string' && (body.status === 'draft' || body.status === 'published')) {
    data.status = body.status
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  const article = await db.article.update({ where: { id }, data })
  return NextResponse.json({ article })
}

/** DELETE /api/articles/[id] — cascade-deletes all sections, versions, and research. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await db.article.delete({ where: { id } }).catch(() => null)
  return NextResponse.json({ ok: true })
}
