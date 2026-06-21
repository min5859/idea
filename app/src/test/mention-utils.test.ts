import { describe, expect, it } from 'vitest'
import {
  applyMention,
  extractMentions,
  filterMentionCandidates,
  readMentionQuery,
} from '../screens/chat/mention-utils'

describe('readMentionQuery', () => {
  it('detects trailing @query (start of input)', () => {
    expect(readMentionQuery('@fr')).toBe('fr')
  })
  it('detects @query after whitespace', () => {
    expect(readMentionQuery('hello @ko')).toBe('ko')
  })
  it('returns empty string right after @', () => {
    expect(readMentionQuery('hey @')).toBe('')
  })
  it('returns null when @ token is not trailing', () => {
    expect(readMentionQuery('@fr hello')).toBeNull()
    expect(readMentionQuery('email me@example then')).toBeNull()
  })
  it('returns null with no @', () => {
    expect(readMentionQuery('plain text')).toBeNull()
  })
})

describe('filterMentionCandidates', () => {
  const names = ['frontend-eng', 'tauri-backend', 'reviewer', 'pm']
  it('returns all when query empty', () => {
    expect(filterMentionCandidates(names, '')).toEqual(names)
  })
  it('filters case-insensitively by substring', () => {
    expect(filterMentionCandidates(names, 'EN')).toEqual([
      'frontend-eng',
      'tauri-backend',
    ])
    expect(filterMentionCandidates(names, 'pm')).toEqual(['pm'])
  })
})

describe('applyMention', () => {
  it('replaces trailing @query with @name + space', () => {
    expect(applyMention('hello @fr', 'frontend-eng')).toBe(
      'hello @frontend-eng ',
    )
  })
  it('replaces bare @', () => {
    expect(applyMention('@', 'pm')).toBe('@pm ')
  })
  it('appends with separating space when no trigger', () => {
    expect(applyMention('do this', 'pm')).toBe('do this @pm ')
    expect(applyMention('', 'pm')).toBe('@pm ')
  })
})

describe('extractMentions', () => {
  it('extracts unique mentions in order', () => {
    expect(extractMentions('@pm plan then @frontend-eng build, @pm review')).toEqual([
      'pm',
      'frontend-eng',
    ])
  })
  it('ignores emails', () => {
    expect(extractMentions('mail me@x.com please')).toEqual([])
  })
})
