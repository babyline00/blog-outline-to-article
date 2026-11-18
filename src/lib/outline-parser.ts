/**
 * Outline parser.
 *
 * An outline is a multi-line text where:
 *   - The first non-empty line is the article TITLE.
 *   - Each subsequent non-empty line is a SECTION heading.
 *   - A heading line may carry an optional one-line "angle" note separated
 *     by ` | ` or ` // ` (e.g. `Vector databases | focus on HNSW trade-offs`).
 *   - Leading `#` markers (`#`, `##`, `###`) are stripped from both title
 *     and headings — the editor renders its own hierarchy based on ordinal.
 *
 * The result is a deterministic `{ title, sections[] }` object. Rendering
 * back to outline text is the inverse and is used when populating the
 * "New article" modal's outline textarea.
 */

export interface ParsedSection {
  heading: string
  angle?: string
}

export interface ParsedOutline {
  title: string
  sections: ParsedSection[]
}

const ANGLE_SEPARATOR = /\s+(?:\||\/\/)\s+/

/** Strip leading `#` markdown heading markers and surrounding whitespace. */
export function stripHeadingMarker(s: string): string {
  return s
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/\s+#+\s*$/, '')
    .trim()
}

/** Split a heading line into `{ heading, angle? }`. */
export function splitHeadingAngle(line: string): ParsedSection {
  // Match `heading | angle` or `heading // angle`. The `heading` part is
  // non-greedy; the `angle` part may be empty (e.g. `Intro | `), in which
  // case we treat the line as a heading-only section.
  const m = line.match(/^(.+?)\s+(?:\||\/\/)\s*(.*)$/)
  if (m) {
    const heading = stripHeadingMarker(m[1])
    const angle = m[2].trim()
    return angle.length > 0 ? { heading, angle } : { heading }
  }
  return { heading: stripHeadingMarker(line) }
}

/**
 * Parse a multi-line outline string into `{ title, sections }`.
 *
 * - Empty lines are skipped.
 * - The first surviving non-empty line is the title.
 * - Subsequent surviving non-empty lines are sections (in document order).
 */
export function parseOutline(text: string): ParsedOutline {
  const lines = (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
  if (lines.length === 0) return { title: '', sections: [] }
  const [titleLine, ...rest] = lines
  const title = stripHeadingMarker(titleLine)
  const sections = rest.map((line) => splitHeadingAngle(line))
  return { title, sections }
}

/**
 * Render an outline back to text. Inverse of `parseOutline` (modulo
 * whitespace). Used to seed the "New article" textarea from an existing
 * article's title+sections.
 */
export function renderOutline(title: string, sections: ParsedSection[]): string {
  const lines: string[] = []
  if (title.trim().length > 0) lines.push(title.trim())
  for (const s of sections) {
    if (s.angle && s.angle.trim().length > 0) {
      lines.push(`${s.heading} | ${s.angle.trim()}`)
    } else {
      lines.push(s.heading)
    }
  }
  return lines.join('\n')
}

/** Detect just the title from a partial outline (the first non-empty line). */
export function detectTitle(text: string): string | null {
  const first = (text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  if (!first) return null
  return stripHeadingMarker(first)
}
