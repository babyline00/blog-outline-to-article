import { test, expect, describe } from 'bun:test'
import {
  buildSectionDraftPrompt,
  getDraftProvider,
  __setDraftProviderForTest,
  type DraftProvider,
  type SectionDraftInput,
} from '../ai'
import { getTonePreset, getDefaultTonePreset } from '../tone-presets'

const baseInput: SectionDraftInput = {
  heading: 'HNSW Trade-offs',
  angle: 'focus on memory vs recall',
  articleTitle: 'Vector Databases 101',
  articleTopic: 'A practical intro to vector databases',
  tone: getDefaultTonePreset(),
  research: [
    {
      id: 'r1',
      title: 'HNSW paper',
      url: 'https://example.com/hnsw',
      snippet: 'HNSW offers O(log N) lookup with high recall.',
      publishedTime: '2024-03-15',
    },
    {
      id: 'r2',
      title: 'pgvector docs',
      url: 'https://example.com/pgvector',
      snippet: 'pgvector supports HNSW and IVFFlat indexes.',
      publishedTime: null,
    },
  ],
}

describe('buildSectionDraftPrompt', () => {
  const { systemPrompt, userPrompt } = buildSectionDraftPrompt(baseInput)

  test('systemPrompt contains the tone name', () => {
    expect(systemPrompt).toContain('TONE: informative')
  })
  test('systemPrompt contains the tone label', () => {
    expect(systemPrompt).toContain('(Informative)')
  })
  test('systemPrompt contains the article title', () => {
    expect(systemPrompt).toContain('Article title: Vector Databases 101')
  })
  test('systemPrompt contains the article topic when provided', () => {
    expect(systemPrompt).toContain('Article topic: A practical intro to vector databases')
  })
  test('systemPrompt instructs the model to use [^cN] markers', () => {
    expect(systemPrompt).toContain('[^c1]')
    expect(systemPrompt.toLowerCase()).toContain('cite')
  })
  test('systemPrompt forbids emitting footnote definitions', () => {
    expect(systemPrompt).toContain('Do NOT include the footnote definitions')
  })
  test('userPrompt contains the section heading', () => {
    expect(userPrompt).toContain('Section heading: HNSW Trade-offs')
  })
  test('userPrompt contains the angle when provided', () => {
    expect(userPrompt).toContain('Angle to take: focus on memory vs recall')
  })
  test('userPrompt lists research results with [^c1], [^c2] labels', () => {
    expect(userPrompt).toContain('[^c1]: HNSW paper')
    expect(userPrompt).toContain('[^c2]: pgvector docs')
  })
  test('userPrompt includes research URLs', () => {
    expect(userPrompt).toContain('URL: https://example.com/hnsw')
    expect(userPrompt).toContain('URL: https://example.com/pgvector')
  })
  test('userPrompt includes publishedTime when present', () => {
    expect(userPrompt).toContain('published: 2024-03-15')
  })

  test('omits article topic line when topic is null', () => {
    const input: SectionDraftInput = { ...baseInput, articleTopic: null }
    const { systemPrompt } = buildSectionDraftPrompt(input)
    expect(systemPrompt).not.toContain('Article topic:')
  })

  test('omits angle line when angle is null', () => {
    const input: SectionDraftInput = { ...baseInput, angle: null }
    const { userPrompt } = buildSectionDraftPrompt(input)
    expect(userPrompt).not.toContain('Angle to take:')
  })
})

describe('buildSectionDraftPrompt — empty research', () => {
  const { userPrompt } = buildSectionDraftPrompt({ ...baseInput, research: [] })

  test('tells the model no research was provided', () => {
    expect(userPrompt.toLowerCase()).toContain('no research results were provided')
  })
  test('tells the model not to use [^cN] markers when there is no research', () => {
    expect(userPrompt).toContain('do NOT use [^cN] markers')
  })
})

describe('buildSectionDraftPrompt — tone variants', () => {
  test('technical tone is reflected in the system prompt', () => {
    const technical = getTonePreset('technical')!
    const { systemPrompt } = buildSectionDraftPrompt({ ...baseInput, tone: technical })
    expect(systemPrompt).toContain('TONE: technical')
  })
  test('thought-leadership tone is reflected in the system prompt', () => {
    const tl = getTonePreset('thought-leadership')!
    const { systemPrompt } = buildSectionDraftPrompt({ ...baseInput, tone: tl })
    expect(systemPrompt).toContain('TONE: thought-leadership')
  })
})

describe('DraftProvider (mock)', () => {
  class MockDraft implements DraftProvider {
    async complete(args: { systemPrompt: string; userPrompt: string }): Promise<string> {
      return `[mock] ${args.userPrompt.slice(0, 30)}`
    }
  }

  test('returns the assistant text from the provider', async () => {
    __setDraftProviderForTest(new MockDraft())
    const provider = getDraftProvider()
    const out = await provider.complete({
      systemPrompt: 'sys',
      userPrompt: 'hello world this is a test',
    })
    expect(out).toBe('[mock] hello world this is a test')
    __setDraftProviderForTest(null)
  })

  test('getDraftProvider returns the same instance on repeated calls', () => {
    __setDraftProviderForTest(new MockDraft())
    const a = getDraftProvider()
    const b = getDraftProvider()
    expect(a).toBe(b)
    __setDraftProviderForTest(null)
  })
})
