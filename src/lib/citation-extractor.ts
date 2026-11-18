/**
 * Citation extractor.
 *
 * Drafts produced by the LLM contain inline `[^c1]`, `[^c2]` markers
 * (markdown footnote references). This module extracts those markers
 * in document order, dedupes them, and exposes the ordered list to:
 *   - The draft route (to build the citations JSON array persisted to
 *     SectionVersion).
 *   - The export step (to map local [^cN] markers back to global footnotes).
 */

export interface ExtractedMarker {
  /** Raw marker without the brackets, e.g. `"c1"`. */
  marker: string
  /** 1-based ordinal parsed from the marker, e.g. `1` for `"c1"`. */
  ordinal: number
}

const CITATION_RE = /\[\^(c\d+)\]/g

/**
 * Extract all `[^cN]` markers from `text` in document order, deduped by
 * the marker string. The first occurrence of each marker is kept.
 */
export function extractCitationMarkers(text: string): ExtractedMarker[] {
  if (!text) return []
  const seen = new Set<string>()
  const out: ExtractedMarker[] = []
  let m: RegExpExecArray | null
  CITATION_RE.lastIndex = 0
  while ((m = CITATION_RE.exec(text)) !== null) {
    const marker = m[1]
    if (seen.has(marker)) continue
    seen.add(marker)
    out.push({ marker, ordinal: parseInt(marker.slice(1), 10) })
  }
  return out
}

/** Just the unique marker strings (`"c1"`, `"c2"`, ...), in document order. */
export function extractUniqueMarkers(text: string): string[] {
  return extractCitationMarkers(text).map((m) => m.marker)
}

/** Just the unique 1-based ordinals, in document order. */
export function extractUniqueOrdinals(text: string): number[] {
  return extractCitationMarkers(text).map((m) => m.ordinal)
}

/**
 * Strip all `[^cN]` markers from `text` (used by the plain-text preview
 * in the UI when we want to show the draft without inline markers).
 */
export function stripCitationMarkers(text: string): string {
  return (text ?? '').replace(CITATION_RE, '')
}
