/**
 * Tone presets.
 *
 * Each preset defines:
 *   - `name`         — stable identifier persisted on `Article.tone`
 *   - `label`        — human-friendly label for the dropdown
 *   - `description`  — short blurb shown in the UI
 *   - `systemPrompt` — directive the LLM follows when drafting
 *   - `example`      — ONE example section showing the tone in action
 *
 * Every preset MUST have a systemPrompt and exactly one example — the test
 * suite asserts this so we can never ship a half-specified tone.
 */

export type ToneName =
  | 'informative'
  | 'casual'
  | 'technical'
  | 'thought-leadership'

export interface TonePreset {
  name: ToneName
  label: string
  description: string
  systemPrompt: string
  example: string
}

export const TONE_PRESETS: TonePreset[] = [
  {
    name: 'informative',
    label: 'Informative',
    description:
      'Clear, factual, neutral — like a Wikipedia article or a good explainer post.',
    systemPrompt:
      'You are an informative blog writer. Write in clear, neutral prose. ' +
      'Explain concepts in plain language. Cite every factual claim with [^cN] markers.',
    example:
      '## Example\n\n' +
      'Vector databases store embeddings as high-dimensional vectors [^c1]. ' +
      'Retrieval works by computing cosine similarity between a query vector ' +
      'and stored vectors [^c2].',
  },
  {
    name: 'casual',
    label: 'Casual',
    description:
      'Friendly, conversational, second-person — like a friend explaining over coffee.',
    systemPrompt:
      'You are a casual blog writer. Use second-person ("you"), contractions, ' +
      'and light humor where natural. Keep paragraphs short. Still cite every ' +
      'factual claim with [^cN] markers.',
    example:
      '## Example\n\n' +
      'So you have probably wondered how a vector database actually works [^c1]. ' +
      'It is simpler than it sounds — think of it as a librarian who sorts books ' +
      'by how similar their topics are [^c2].',
  },
  {
    name: 'technical',
    label: 'Technical',
    description:
      'Precise, system-naming, trade-off-aware — like a senior engineer writing for engineers.',
    systemPrompt:
      'You are a technical blog writer. Name systems, libraries, and trade-offs ' +
      'explicitly. Use precise vocabulary. Show code when relevant. Cite every ' +
      'claim with [^cN] markers.',
    example:
      '## Example\n\n' +
      'pgvector stores embeddings in a PostgreSQL column of type `vector(N)` and ' +
      'uses HNSW indexes for ANN search with O(log N) lookup [^c1]. Trade-off: ' +
      'index build time vs. recall — HNSW favors recall at the cost of memory [^c2].',
  },
  {
    name: 'thought-leadership',
    label: 'Thought Leadership',
    description:
      'Opinionated, thesis-driven, takes a stand — like a seasoned leader writing an essay.',
    systemPrompt:
      'You are a thought-leadership writer. Take a clear stance. Open with a thesis, ' +
      'defend it with evidence and citations, and close with a forward-looking ' +
      'implication. Cite every factual claim with [^cN] markers.',
    example:
      '## Example\n\n' +
      'The shift from keyword search to retrieval-augmented generation is not ' +
      'incremental — it is a paradigm change [^c1]. Teams that treat RAG as "search ' +
      'with extra steps" will ship brittle demos; teams that treat it as a ' +
      'retrieval problem first will ship products [^c2].',
  },
]

export const TONE_BY_NAME: Record<string, TonePreset> = Object.fromEntries(
  TONE_PRESETS.map((p) => [p.name, p]),
)

export const DEFAULT_TONE: ToneName = 'informative'

export function getTonePreset(name: string): TonePreset | null {
  return TONE_BY_NAME[name] ?? null
}

export function getDefaultTonePreset(): TonePreset {
  return TONE_BY_NAME[DEFAULT_TONE]
}

/** All tone names in stable order. */
export const TONE_NAMES: ToneName[] = TONE_PRESETS.map((p) => p.name)
