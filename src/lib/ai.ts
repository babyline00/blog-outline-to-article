/**
 * Section draft AI provider + prompt builder.
 *
 * Wraps the z-ai-web-dev-sdk chat-completion endpoint behind a small
 * `DraftProvider` interface so the implementation is pluggable. The
 * `ZaiProvider` issues a NON-STREAMING completion (a section draft is a
 * bounded unit of work and benefits from a single complete response);
 * the `MockProvider` is a deterministic offline fallback used when
 * `PKC_DISABLE_LLM=1` or when the SDK config is unavailable (e.g. in
 * `bun test`).
 *
 * `buildSectionDraftPrompt` is a PURE function — the heart of the
 * outline-first differentiator:
 *   1. It bakes the section's research results into the USER prompt as
 *      numbered footnote-labels ([^c1], [^c2], ...).
 *   2. It instructs the model to use those exact markers when citing.
 *   3. It carries the article-level context (title, topic, tone) in the
 *      SYSTEM prompt.
 *   4. It forbids the model from emitting footnote definitions — the
 *      export step owns the footnotes.
 */

import type { TonePreset } from '@/lib/tone-presets'

export interface ResearchItem {
  id: string
  title: string
  url: string
  snippet: string
  publishedTime?: string | null
}

export interface SectionDraftInput {
  heading: string
  angle?: string | null
  articleTitle: string
  articleTopic?: string | null
  tone: TonePreset
  research: ResearchItem[]
}

export interface DraftProvider {
  complete(args: { systemPrompt: string; userPrompt: string }): Promise<string>
}

let cachedProvider: DraftProvider | null = null

class ZaiProvider implements DraftProvider {
  async complete(args: { systemPrompt: string; userPrompt: string }): Promise<string> {
    // Dynamic import so a missing config in unit-test envs does not crash
    // module-level evaluation.
    const ZAI = (await import('z-ai-web-dev-sdk')).default
    const zai = await ZAI.create()
    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'system', content: args.systemPrompt },
        { role: 'user', content: args.userPrompt },
      ],
      stream: false,
      thinking: { type: 'disabled' },
    })
    if (typeof completion === 'string') return completion
    // stream:false returns an object; extract the assistant content.
    const content = (completion as any)?.choices?.[0]?.message?.content
    return typeof content === 'string' ? content : ''
  }
}

class MockProvider implements DraftProvider {
  async complete(args: { systemPrompt: string; userPrompt: string }): Promise<string> {
    // Deterministic offline mock — produces a section draft with [^cN]
    // markers so the citation pipeline still exercises end-to-end.
    const toneLine = args.systemPrompt
      .split('\n')
      .find((l) => l.startsWith('TONE:'))
    const tone = toneLine ? toneLine.replace('TONE:', '').trim() : 'unknown'
    const citeCount = (args.userPrompt.match(/\[\^c\d+\]:/g) || []).length
    const cites = citeCount > 0
      ? Array.from({ length: Math.min(citeCount, 3) }, (_, i) => `[^c${i + 1}]`).join(' and ')
      : '(no research provided)'
    return [
      `(mock draft · tone=${tone})`,
      '',
      `This is a mock draft for the section. The real LLM is disabled ` +
        `(PKC_DISABLE_LLM=1 or no z-ai-web-dev-sdk config).`,
      '',
      `Sample claim with citation ${cites}. The export step will turn ` +
        `those markers into footnotes.`,
      '',
      `_Mock user prompt prefix: ${args.userPrompt.split('\n')[0].slice(0, 120)}_`,
    ].join('\n')
  }
}

export function getDraftProvider(): DraftProvider {
  if (cachedProvider) return cachedProvider
  if (process.env.PKC_DISABLE_LLM === '1') {
    cachedProvider = new MockProvider()
    return cachedProvider
  }
  try {
    cachedProvider = new ZaiProvider()
  } catch (e) {
    console.warn('[ai] ZaiProvider unavailable, using MockProvider:', (e as Error).message)
    cachedProvider = new MockProvider()
  }
  return cachedProvider
}

/** Test-only — inject or clear the provider. */
export function __setDraftProviderForTest(p: DraftProvider | null) {
  cachedProvider = p
}

/**
 * Build the system + user prompts for a single section draft.
 *
 * The system prompt encodes tone, article context, and STRICT output rules.
 * The user prompt encodes the section heading, angle, and the research
 * results numbered with [^c1], [^c2], ... labels that the model is asked
 * to reuse when citing.
 *
 * Pure function — safe to unit-test without any LLM.
 */
export function buildSectionDraftPrompt(section: SectionDraftInput): {
  systemPrompt: string
  userPrompt: string
} {
  const researchLines: string[] = []
  section.research.forEach((r, i) => {
    const pub = r.publishedTime ? ` (published: ${r.publishedTime})` : ''
    researchLines.push(
      `[^c${i + 1}]: ${r.title}${pub}\nURL: ${r.url}\nSnippet: ${r.snippet}`,
    )
  })
  const hasResearch = researchLines.length > 0
  const researchBlock = hasResearch
    ? [
        'Research results (use the bracketed markers like [^c1], [^c2], etc. ' +
          'to cite them inline — the marker number MUST match the order shown here):',
        '',
        researchLines.join('\n\n'),
      ].join('\n')
    : [
        'No research results were provided for this section. Write a thoughtful ' +
          'section using your own knowledge; do NOT use [^cN] markers if there is ' +
          'no research to cite.',
      ].join('\n')

  const systemPrompt = [
    `TONE: ${section.tone.name} (${section.tone.label})`,
    `Article title: ${section.articleTitle}`,
    section.articleTopic ? `Article topic: ${section.articleTopic}` : '',
    '',
    'You are a blog article writer drafting ONE section of a longer article.',
    `Tone description: ${section.tone.description}`,
    `Tone system instruction: ${section.tone.systemPrompt}`,
    '',
    'Output rules (STRICT):',
    '1. Write ONLY the body of this section — do NOT add the section heading ' +
      '(the editor renders its own heading).',
    '2. Use Markdown for structure (paragraphs, lists, bold, links, code ' +
      'blocks where useful).',
    '3. Cite every factual claim using inline footnote markers: [^c1], ' +
      '[^c2], etc.',
    '4. The marker number MUST match the order of the research result it ' +
      'cites (c1 = first result, c2 = second, etc.).',
    '5. Do NOT include the footnote definitions (the `[^c1]: ...` lines) — ' +
      'the export step adds them.',
    '6. Aim for 150-400 words unless the section is intentionally short.',
    '7. Do NOT wrap the response in markdown code fences.',
  ]
    .filter((l) => l.length > 0)
    .join('\n')

  const userPrompt = [
    `Section heading: ${section.heading}`,
    section.angle ? `Angle to take: ${section.angle}` : '',
    '',
    researchBlock,
  ]
    .filter((l) => l.length > 0)
    .join('\n')

  return { systemPrompt, userPrompt }
}
