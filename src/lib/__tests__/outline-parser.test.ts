import { test, expect, describe } from 'bun:test'
import {
  parseOutline,
  renderOutline,
  detectTitle,
  splitHeadingAngle,
  stripHeadingMarker,
} from '../outline-parser'

describe('parseOutline', () => {
  test('single line -> title only, no sections', () => {
    const out = parseOutline('My Article')
    expect(out.title).toBe('My Article')
    expect(out.sections).toEqual([])
  })
  test('multi-line -> first line is title, rest are sections in order', () => {
    const out = parseOutline('My Article\nIntro\nBody\nConclusion')
    expect(out.title).toBe('My Article')
    expect(out.sections.map((s) => s.heading)).toEqual(['Intro', 'Body', 'Conclusion'])
    expect(out.sections.every((s) => s.angle === undefined)).toBe(true)
  })
  test('strips leading # markdown markers from title', () => {
    expect(parseOutline('# My Article').title).toBe('My Article')
    expect(parseOutline('## My Article').title).toBe('My Article')
  })
  test('strips leading # markdown markers from section headings', () => {
    const out = parseOutline('Title\n## Intro\n### Body')
    expect(out.sections[0].heading).toBe('Intro')
    expect(out.sections[1].heading).toBe('Body')
  })
  test('parses angle after | separator', () => {
    const out = parseOutline('Title\nIntro | focus on HNSW trade-offs')
    expect(out.sections[0].heading).toBe('Intro')
    expect(out.sections[0].angle).toBe('focus on HNSW trade-offs')
  })
  test('parses angle after // separator', () => {
    const out = parseOutline('Title\nIntro // best for short articles')
    expect(out.sections[0].heading).toBe('Intro')
    expect(out.sections[0].angle).toBe('best for short articles')
  })
  test('skips empty lines', () => {
    const out = parseOutline('\nTitle\n\nIntro\n\n\nBody\n')
    expect(out.title).toBe('Title')
    expect(out.sections.map((s) => s.heading)).toEqual(['Intro', 'Body'])
  })
  test('empty input -> empty title and sections', () => {
    const out = parseOutline('')
    expect(out.title).toBe('')
    expect(out.sections).toEqual([])
  })
  test('whitespace-only input -> empty title and sections', () => {
    const out = parseOutline('   \n  \n  ')
    expect(out.title).toBe('')
    expect(out.sections).toEqual([])
  })
})

describe('renderOutline (inverse of parseOutline)', () => {
  test('round-trips title + sections', () => {
    const text = 'My Article\nIntro\nBody'
    const parsed = parseOutline(text)
    const rendered = renderOutline(parsed.title, parsed.sections)
    expect(rendered).toBe(text)
  })
  test('includes angle line when present', () => {
    const rendered = renderOutline('Title', [{ heading: 'Intro', angle: 'focus on HNSW' }])
    expect(rendered).toBe('Title\nIntro | focus on HNSW')
  })
  test('omits angle line when absent', () => {
    const rendered = renderOutline('Title', [{ heading: 'Intro' }])
    expect(rendered).toBe('Title\nIntro')
  })
})

describe('detectTitle', () => {
  test('returns first non-empty line stripped of # markers', () => {
    expect(detectTitle('# My Article\nIntro\nBody')).toBe('My Article')
  })
  test('returns null for empty input', () => {
    expect(detectTitle('')).toBeNull()
  })
  test('returns null for whitespace-only input', () => {
    expect(detectTitle('   \n\n')).toBeNull()
  })
})

describe('splitHeadingAngle', () => {
  test('heading only', () => {
    expect(splitHeadingAngle('Intro')).toEqual({ heading: 'Intro' })
  })
  test('heading + angle with |', () => {
    expect(splitHeadingAngle('Intro | focus')).toEqual({ heading: 'Intro', angle: 'focus' })
  })
  test('heading + angle with //', () => {
    expect(splitHeadingAngle('Intro // note')).toEqual({ heading: 'Intro', angle: 'note' })
  })
  test('strips # markers from heading', () => {
    expect(splitHeadingAngle('## Intro').heading).toBe('Intro')
  })
  test('empty angle after separator is ignored', () => {
    expect(splitHeadingAngle('Intro | ')).toEqual({ heading: 'Intro' })
  })
})

describe('stripHeadingMarker', () => {
  test('strips leading #', () => {
    expect(stripHeadingMarker('# Title')).toBe('Title')
    expect(stripHeadingMarker('### Title')).toBe('Title')
  })
  test('no # markers returns as-is', () => {
    expect(stripHeadingMarker('Title')).toBe('Title')
  })
  test('trims whitespace', () => {
    expect(stripHeadingMarker('   # Title   ')).toBe('Title')
  })
})
