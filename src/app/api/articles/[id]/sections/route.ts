import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/articles/[id]/sections — add a new section to an article.
 *
 * Body:
 *   - heading: string               (required — non-empty)
 *   - angle: string                 (optional one-line angle note)
 *   - ordinal: number               (optional — defaults to end of list)
 *
 * Returns the created section.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const heading = (body?.heading ?? '').toString().trim()
  if (!heading) {
    return NextResponse.json({ error: 'heading is required' }, { status: 400 })
  }
  const article = await db.article.findUnique({ where: { id }, select: { id: true } })
  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  const count = await db.section.count({ where: { articleId: id } })
  const ordinal =
    typeof body?.ordinal === 'number' && Number.isInteger(body.ordinal) && body.ordinal >= 0
      ? body.ordinal
      : count

  // Shift existing sections at >= ordinal up by 1 if inserting in the middle.
  if (ordinal < count) {
    await db.section.updateMany({
      where: { articleId: id, ordinal: { gte: ordinal } },
      data: { ordinal: { increment: 1 } },
    })
  }

  const section = await db.section.create({
    data: {
      articleId: id,
      ordinal,
      heading,
      angle: typeof body?.angle === 'string' && body.angle.trim().length > 0
        ? body.angle.trim()
        : null,
    },
  })
  return NextResponse.json({ section }, { status: 201 })
}
