/**
 * Export compiler.
 *
 * Two pure functions:
 *   - `compileToMarkdown(input)` — single Markdown string with `# Title`,
 *     one `## Heading` per section, inline `[^cN]` markers RENUMBERED
 *     globally across the article, and a footnotes block at the end.
 *   - `compileToMdx(input)` — wraps `compileToMarkdown` with Hashnode-style
 *     YAML front-matter (`title`, `publishedAt`, `tags`).
 *
 * Both functions are pure — they take a plain object and return a string.
 * The API route at `/api/articles/[id]/export` hydrates the Prisma rows
 * into this object shape and calls these functions.
 *
 * Why global renumbering? Each section's draft uses LOCAL [^c1], [^c2]
 * markers referring to THAT section's research. If we kept the local
 * numbers, citations from different sections would collide in the
 * exported article's footnotes block. So we walk sections in order, and
 * for each unique cited researchId we assign the next global ordinal
 * (1, 2, 3, ...) and rewrite the draft's inline markers accordingly.
 */

export interface ExportCitation {
  researchId: string
  title: string
  url: string
  snippet: string
  publishedTime?: string | null
}

export interface ExportSection {
  id: string
  ordinal: number
  heading: string
  angle?: string | null
  currentDraft: { content: string; citations: string } | null
}

export interface ExportArticle {
  title: string
  topic?: string | null
  tone?: string | null
  tags: string
  createdAt: Date | string
  updatedAt: Date | string
}

export interface ExportInput {
  article: ExportArticle
  sections: ExportSection[]
}

interface GlobalCite {
  ordinal: number
  cite: ExportCitation
}

const CITATION_RE = /\[\^(c\d+)\]/g

function parseCitations(raw: string): ExportCitation[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((c) => c && typeof c.researchId === 'string')
  } catch {
    return []
  }
}

/** Render a single citation footnote line. */
function renderFootnote(c: ExportCitation, ordinal: number): string {
  const pub = c.publishedTime ? ` (${c.publishedTime})` : ''
  return `[^c${ordinal}]: [${c.title}](${c.url})${pub} — ${c.snippet}`
}

/**
 * Compile an article to a single Markdown string.
 *
 * The structure is:
 *   # Article Title
 *   > topic (if present)
 *
 *   ## Section 1 heading
 *   draft body with [^cN] (renumbered globally)
 *
 *   ## Section 2 heading
 *   ...
 *
 *   [^c1]: footnote 1
 *   [^c2]: footnote 2
 *   ...
 */
export function compileToMarkdown(input: ExportInput): string {
  const { article, sections } = input
  const lines: string[] = []
  lines.push(`# ${article.title}`)
  if (article.topic && article.topic.trim().length > 0) {
    lines.push('', `> ${article.topic.trim()}`)
  }
  lines.push('')

  const globalCitations = new Map<string, GlobalCite>()
  let nextOrdinal = 1

  const registerCite = (c: ExportCitation): number => {
    if (globalCitations.has(c.researchId)) {
      return globalCitations.get(c.researchId)!.ordinal
    }
    const ordinal = nextOrdinal++
    globalCitations.set(c.researchId, { ordinal, cite: c })
    return ordinal
  }

  for (const section of sections) {
    lines.push(`## ${section.heading}`)
    if (section.angle && section.angle.trim().length > 0) {
      lines.push('', `*${section.angle.trim()}*`)
    }
    lines.push('')

    if (!section.currentDraft) {
      lines.push('_(No draft yet for this section.)_', '')
      continue
    }

    const cites = parseCitations(section.currentDraft.citations)
    // Pre-register all citations so the footnotes include every cited item,
    // not just the ones the LLM referenced with a marker.
    cites.forEach((c) => registerCite(c))

    // Rewrite inline [^cN] markers to use global ordinals.
    let content = section.currentDraft.content || ''
    content = content.replace(CITATION_RE, (match, marker: string) => {
      const localIdx = parseInt(marker.slice(1), 10) - 1
      if (localIdx < 0 || localIdx >= cites.length) return match
      const ordinal = registerCite(cites[localIdx])
      return `[^c${ordinal}]`
    })
    lines.push(content, '')
  }

  // Footnotes block — sorted by global ordinal so they appear 1..N.
  const sortedCites = Array.from(globalCitations.values()).sort(
    (a, b) => a.ordinal - b.ordinal,
  )
  if (sortedCites.length > 0) {
    lines.push('---', '')
    for (const g of sortedCites) {
      lines.push(renderFootnote(g.cite, g.ordinal))
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

/** Format a Date or ISO string as a Hashnode-friendly `publishedAt`. */
function formatPublishedAt(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  if (isNaN(date.getTime())) return new Date().toISOString()
  return date.toISOString()
}

/** Parse a comma-separated tags string into a clean array. */
function parseTags(tags: string): string[] {
  if (!tags) return []
  return tags
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

/**
 * Compile an article to MDX with Hashnode-style YAML front-matter.
 *
 * Front-matter shape:
 *   ---
 *   title: "Article Title"
 *   publishedAt: "2026-01-01T00:00:00.000Z"
 *   tags: ["tag1", "tag2"]
 *   ---
 *
 * The body is exactly `compileToMarkdown(input)`.
 */
export function compileToMdx(input: ExportInput): string {
  const { article } = input
  const tags = parseTags(article.tags)
  const publishedAt = formatPublishedAt(article.updatedAt)
  const titleJson = JSON.stringify(article.title)
  // Serialize tags as a readable inline array (["a", "b", "c"]) — matches
  // the Hashnode docs style and is easier to scan than the default
  // JSON.stringify output which has no spaces after commas.
  const tagsJson = tags.length > 0
    ? '[' + tags.map((t) => JSON.stringify(t)).join(', ') + ']'
    : '[]'
  const frontMatter = [
    '---',
    `title: ${titleJson}`,
    `publishedAt: "${publishedAt}"`,
    `tags: ${tagsJson}`,
    '---',
    '',
  ].join('\n')
  return frontMatter + '\n' + compileToMarkdown(input)
}
