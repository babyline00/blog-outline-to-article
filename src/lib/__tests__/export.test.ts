import { test, expect, describe } from 'bun:test'
import {
  compileToMarkdown,
  compileToMdx,
  type ExportInput,
} from '../export'

const baseInput: ExportInput = {
  article: {
    title: 'Vector Databases 101',
    topic: 'A practical introduction to vector databases for engineers',
    tone: 'informative',
    tags: 'ai, vector-db, retrieval',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-02-01T12:00:00.000Z'),
  },
  sections: [
    {
      id: 's1',
      ordinal: 0,
      heading: 'Introduction',
      angle: null,
      currentDraft: {
        content: 'Vector databases store embeddings as high-dimensional vectors [^c1]. They power modern retrieval [^c2].',
        citations: JSON.stringify([
          { researchId: 'r1', title: 'Source A', url: 'https://a.example.com', snippet: 'Snip A' },
          { researchId: 'r2', title: 'Source B', url: 'https://b.example.com', snippet: 'Snip B' },
        ]),
      },
    },
    {
      id: 's2',
      ordinal: 1,
      heading: 'Trade-offs',
      angle: 'focus on HNSW vs IVFFlat',
      currentDraft: null,
    },
  ],
}

describe('compileToMarkdown', () => {
  const md = compileToMarkdown(baseInput)

  test('starts with the article title as # heading', () => {
    expect(md.startsWith('# Vector Databases 101')).toBe(true)
  })
  test('includes the topic as a blockquote', () => {
    expect(md).toContain('> A practical introduction to vector databases for engineers')
  })
  test('includes each section heading as ##', () => {
    expect(md).toContain('## Introduction')
    expect(md).toContain('## Trade-offs')
  })
  test('includes the angle line for sections that have one', () => {
    expect(md).toContain('*focus on HNSW vs IVFFlat*')
  })
  test('shows "No draft yet" for sections without a draft', () => {
    expect(md).toContain('_(No draft yet for this section.)_')
  })
  test('preserves the draft body text', () => {
    expect(md).toContain('Vector databases store embeddings as high-dimensional vectors')
  })
  test('preserves [^c1] and [^c2] markers (renumbered globally)', () => {
    expect(md).toContain('[^c1]')
    expect(md).toContain('[^c2]')
  })
  test('appends footnotes for the cited research at the end', () => {
    expect(md).toContain('[^c1]: [Source A](https://a.example.com) — Snip A')
    expect(md).toContain('[^c2]: [Source B](https://b.example.com) — Snip B')
  })
  test('footnotes appear after the section bodies (not interleaved)', () => {
    const lastSectionIdx = md.lastIndexOf('## Trade-offs')
    const footnoteIdx = md.indexOf('[^c1]: [Source A]')
    expect(footnoteIdx).toBeGreaterThan(lastSectionIdx)
  })
})

describe('compileToMarkdown — no drafts', () => {
  test('still produces title and section headings', () => {
    const input: ExportInput = {
      article: { ...baseInput.article, tags: '' },
      sections: [
        { id: 's', ordinal: 0, heading: 'Solo', angle: null, currentDraft: null },
      ],
    }
    const md = compileToMarkdown(input)
    expect(md).toContain('# Vector Databases 101')
    expect(md).toContain('## Solo')
    expect(md).toContain('_(No draft yet for this section.)_')
  })
})

describe('compileToMarkdown — global renumbering', () => {
  test('citations from different sections get unique global ordinals', () => {
    const input: ExportInput = {
      article: { ...baseInput.article, tags: '' },
      sections: [
        {
          id: 's1',
          ordinal: 0,
          heading: 'A',
          angle: null,
          currentDraft: {
            content: 'first [^c1]',
            citations: JSON.stringify([
              { researchId: 'rA', title: 'A', url: 'https://a', snippet: 'sa' },
            ]),
          },
        },
        {
          id: 's2',
          ordinal: 1,
          heading: 'B',
          angle: null,
          currentDraft: {
            content: 'second [^c1]',
            citations: JSON.stringify([
              { researchId: 'rB', title: 'B', url: 'https://b', snippet: 'sb' },
            ]),
          },
        },
      ],
    }
    const md = compileToMarkdown(input)
    // Each section's local [^c1] should be renumbered to global 1 and 2.
    expect(md).toContain('first [^c1]')
    expect(md).toContain('second [^c2]')
    expect(md).toContain('[^c1]: [A](https://a) — sa')
    expect(md).toContain('[^c2]: [B](https://b) — sb')
  })
})

describe('compileToMdx', () => {
  const mdx = compileToMdx(baseInput)

  test('starts with --- YAML front-matter opening', () => {
    expect(mdx.startsWith('---\n')).toBe(true)
  })
  test('includes title in front-matter', () => {
    expect(mdx).toContain('title: "Vector Databases 101"')
  })
  test('includes publishedAt in front-matter (ISO date)', () => {
    expect(mdx).toContain('publishedAt: "2026-02-01T12:00:00.000Z"')
  })
  test('includes tags as a JSON array in front-matter', () => {
    expect(mdx).toContain('tags: ["ai", "vector-db", "retrieval"]')
  })
  test('front-matter is closed with a second --- line', () => {
    expect(mdx).toMatch(/^---\n[\s\S]*?\n---\n/)
  })
  test('body after front-matter is the same as compileToMarkdown output', () => {
    const body = mdx.replace(/^---\n[\s\S]*?\n---\n\n/, '')
    expect(body).toBe(compileToMarkdown(baseInput))
  })
  test('handles empty tags gracefully', () => {
    const input: ExportInput = {
      article: { ...baseInput.article, tags: '' },
      sections: [],
    }
    const mdx2 = compileToMdx(input)
    expect(mdx2).toContain('tags: []')
  })
})
