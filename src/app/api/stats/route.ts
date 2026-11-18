import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/stats — aggregate counts for the dashboard header.
 *
 * Returns:
 *   { articles, sections, drafts, research }
 */
export async function GET() {
  const [articles, sections, drafts, research] = await Promise.all([
    db.article.count(),
    db.section.count(),
    db.sectionVersion.count(),
    db.research.count(),
  ])
  return NextResponse.json({ articles, sections, drafts, research })
}
