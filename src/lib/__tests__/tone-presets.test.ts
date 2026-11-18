import { test, expect, describe } from 'bun:test'
import {
  TONE_PRESETS,
  TONE_BY_NAME,
  getTonePreset,
  getDefaultTonePreset,
  DEFAULT_TONE,
  TONE_NAMES,
  type TonePreset,
} from '../tone-presets'

describe('TONE_PRESETS', () => {
  test('has exactly 4 presets', () => {
    expect(TONE_PRESETS).toHaveLength(4)
  })
  test('every preset has a systemPrompt', () => {
    for (const p of TONE_PRESETS) {
      expect(typeof p.systemPrompt).toBe('string')
      expect(p.systemPrompt.length).toBeGreaterThan(20)
    }
  })
  test('every preset has exactly one example', () => {
    for (const p of TONE_PRESETS) {
      expect(typeof p.example).toBe('string')
      expect(p.example.length).toBeGreaterThan(0)
    }
  })
  test('every preset has a label and description', () => {
    for (const p of TONE_PRESETS) {
      expect(p.label.length).toBeGreaterThan(0)
      expect(p.description.length).toBeGreaterThan(0)
    }
  })
  test('includes informative, casual, technical, thought-leadership', () => {
    const names = TONE_PRESETS.map((p) => p.name)
    expect(names).toContain('informative')
    expect(names).toContain('casual')
    expect(names).toContain('technical')
    expect(names).toContain('thought-leadership')
  })
  test('every preset systemPrompt mentions [^cN] citation markers', () => {
    for (const p of TONE_PRESETS) {
      expect(p.systemPrompt).toMatch(/\[\^cN\]/)
    }
  })
})

describe('TONE_BY_NAME', () => {
  test('has an entry for every preset by name', () => {
    for (const p of TONE_PRESETS) {
      expect(TONE_BY_NAME[p.name]).toBe(p)
    }
  })
})

describe('getTonePreset', () => {
  test('returns the preset for a known name', () => {
    const p = getTonePreset('informative')
    expect(p).not.toBeNull()
    expect(p?.name).toBe('informative')
  })
  test('returns null for an unknown name', () => {
    expect(getTonePreset('does-not-exist')).toBeNull()
  })
  test('returns null for empty string', () => {
    expect(getTonePreset('')).toBeNull()
  })
})

describe('getDefaultTonePreset', () => {
  test('returns the informative preset', () => {
    const p = getDefaultTonePreset()
    expect(p.name).toBe('informative')
  })
  test('DEFAULT_TONE constant is "informative"', () => {
    expect(DEFAULT_TONE).toBe('informative')
  })
})

describe('TONE_NAMES', () => {
  test('has 4 names in the same order as TONE_PRESETS', () => {
    expect(TONE_NAMES).toEqual(TONE_PRESETS.map((p) => p.name))
  })
})

describe('TonePreset type', () => {
  test('a constructed preset passes basic shape check', () => {
    const p: TonePreset = {
      name: 'informative',
      label: 'Informative',
      description: 'd',
      systemPrompt: 's',
      example: 'e',
    }
    expect(p.name).toBe('informative')
    expect(p.label).toBe('Informative')
  })
})
