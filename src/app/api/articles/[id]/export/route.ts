import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { compileToMarkdown, compileToMdx, type ExportInput } from '@/lib/export'

/**
 * POST /api/articles/[id]/export — compile the article to a single string.
 *
 * Body:
 *   - format: "markdown" | "mdx"     (default "markdown")
 *
 * Returns:
 *   - { format, content } — the compiled string.
 *
 * The compiled string is ready to copy-paste into a CMS or save as a .md/.mdx file.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))
  const format = body?.format === 'mdx' ? 'mdx' : 'markdown'

  const article = await db.article.findUnique({
    where: { id },
    include: {
      sections: {
        orderBy: { ordinal: 'asc' },
        include: {
          currentDraft: true,
          research: { orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })
  if (!article) {
    return NextResponse.json({ error: 'Article not found' }, { status: 404 })
  }

  const input: ExportInput = {
    article: {
      title: article.title,
      topic: article.topic,
      tone: article.tone,
      tags: article.tags,
      createdAt: article.createdAt,
      updatedAt: article.updatedAt,
    },
    sections: article.sections.map((s) => ({
      id: s.id,
      ordinal: s.ordinal,
      heading: s.heading,
      angle: s.angle,
      currentDraft: s.currentDraft
        ? { content: s.currentDraft.content, citations: s.currentDraft.citations }
        : null,
    })),
  }

  const content = format === 'mdx' ? compileToMdx(input) : compileToMarkdown(input)
  return NextResponse.json({ format, content })
}
