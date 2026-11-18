import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * PATCH /api/sections/[id] — rename heading / update angle / reorder.
 *
 * Body (any subset):
 *   - heading: string
 *   - angle: string | null
 *   - ordinal: number
 *
 * When `ordinal` changes, sibling sections are shifted to keep ordinals
 * dense and unique within the article.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const existing = await db.section.findUnique({
    where: { id },
    select: { id: true, articleId: true, ordinal: true },
  })
  if (!existing) {
    return NextResponse.json({ error: 'Section not found' }, { status: 404 })
  }

  const data: Record<string, unknown> = {}
  if (typeof body?.heading === 'string' && body.heading.trim().length > 0) {
    data.heading = body.heading.trim()
  }
  if (typeof body?.angle === 'string') {
    data.angle = body.angle.trim().length > 0 ? body.angle.trim() : null
  }
  if (body?.angle === null) {
    data.angle = null
  }

  // Reordering: if the caller asks to move this section to a new ordinal,
  // shift siblings accordingly.
  if (
    typeof body?.ordinal === 'number' &&
    Number.isInteger(body.ordinal) &&
    body.ordinal >= 0 &&
    body.ordinal !== existing.ordinal
  ) {
    const totalCount = await db.section.count({ where: { articleId: existing.articleId } })
    const newOrdinal = Math.min(body.ordinal, totalCount - 1)
    const oldOrdinal = existing.ordinal
    if (newOrdinal < oldOrdinal) {
      await db.section.updateMany({
        where: { articleId: existing.articleId, ordinal: { gte: newOrdinal, lt: oldOrdinal } },
        data: { ordinal: { increment: 1 } },
      })
    } else {
      await db.section.updateMany({
        where: { articleId: existing.articleId, ordinal: { gt: oldOrdinal, lte: newOrdinal } },
        data: { ordinal: { decrement: 1 } },
      })
    }
    data.ordinal = newOrdinal
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  const section = await db.section.update({ where: { id }, data })
  return NextResponse.json({ section })
}

/** DELETE /api/sections/[id] — cascade-deletes the section's versions and research. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const existing = await db.section.findUnique({
    where: { id },
    select: { id: true, articleId: true, ordinal: true },
  })
  if (!existing) {
    return NextResponse.json({ ok: true })
  }
  await db.section.delete({ where: { id } })
  // Compact remaining ordinals so they stay dense (0,1,2,...).
  const remaining = await db.section.findMany({
    where: { articleId: existing.articleId },
    orderBy: { ordinal: 'asc' },
    select: { id: true },
  })
  await Promise.all(
    remaining.map((s, i) =>
      db.section.update({ where: { id: s.id }, data: { ordinal: i } }),
    ),
  )
  return NextResponse.json({ ok: true })
}
