import { test, expect, describe } from 'bun:test'
import {
  extractCitationMarkers,
  extractUniqueMarkers,
  extractUniqueOrdinals,
  stripCitationMarkers,
} from '../citation-extractor'

describe('extractCitationMarkers', () => {
  test('returns empty for empty text', () => {
    expect(extractCitationMarkers('')).toEqual([])
  })
  test('returns empty for text without markers', () => {
    expect(extractCitationMarkers('no markers here')).toEqual([])
  })
  test('extracts a single [^c1] marker', () => {
    expect(extractCitationMarkers('claim [^c1].')).toEqual([
      { marker: 'c1', ordinal: 1 },
    ])
  })
  test('extracts multiple markers in document order', () => {
    const text = 'first [^c2] then [^c1] then [^c3]'
    expect(extractCitationMarkers(text)).toEqual([
      { marker: 'c2', ordinal: 2 },
      { marker: 'c1', ordinal: 1 },
      { marker: 'c3', ordinal: 3 },
    ])
  })
  test('dedupes repeated markers (first-occurrence order)', () => {
    const text = 'first [^c1] then [^c2] then [^c1] again'
    expect(extractCitationMarkers(text)).toEqual([
      { marker: 'c1', ordinal: 1 },
      { marker: 'c2', ordinal: 2 },
    ])
  })
  test('ignores non-citation [^...] markers (like [^note])', () => {
    const text = 'see [^note] and [^c1]'
    expect(extractCitationMarkers(text)).toEqual([{ marker: 'c1', ordinal: 1 }])
  })
  test('handles large ordinals (c100)', () => {
    expect(extractCitationMarkers('big [^c100]')).toEqual([
      { marker: 'c100', ordinal: 100 },
    ])
  })
})

describe('extractUniqueMarkers', () => {
  test('returns just the marker strings in document order', () => {
    expect(extractUniqueMarkers('a [^c1] b [^c2] c [^c1]')).toEqual(['c1', 'c2'])
  })
})

describe('extractUniqueOrdinals', () => {
  test('returns just the 1-based ordinals in document order', () => {
    expect(extractUniqueOrdinals('a [^c3] b [^c1] c [^c3]')).toEqual([3, 1])
  })
})

describe('stripCitationMarkers', () => {
  test('removes all [^cN] markers from text', () => {
    expect(stripCitationMarkers('claim [^c1] and [^c2].')).toBe('claim  and .')
  })
  test('leaves non-citation markers alone', () => {
    expect(stripCitationMarkers('see [^note] and [^c1]')).toBe('see [^note] and ')
  })
  test('empty string -> empty', () => {
    expect(stripCitationMarkers('')).toBe('')
  })
})
