import { describe, expect, it } from 'vitest'
import { parseVersionFilters, versionsMatchForDisplay } from '../checker.ts'

describe('parseVersionFilters', () => {
  it('parses +mc+loader syntax with both fields', () => {
    expect(parseVersionFilters('0.7.6+1.21+neoforge')).toEqual({
      loader: 'neoforge',
      mcVersion: '1.21',
    })
  })

  it('parses +mc syntax and keeps loader null', () => {
    expect(parseVersionFilters('0.7.6+1.21')).toEqual({
      loader: null,
      mcVersion: '1.21',
    })
  })

  it('parses +loader syntax and keeps mcVersion null', () => {
    expect(parseVersionFilters('1.2.0+fabric')).toEqual({
      loader: 'fabric',
      mcVersion: null,
    })
  })

  it('parses dash syntax with comma separated loader and mcVersion', () => {
    expect(parseVersionFilters('3.0.9-fabric,1.20.2')).toEqual({
      loader: 'fabric',
      mcVersion: '1.20.2',
    })
  })

  it('parses dash syntax with hyphen separated mcVersion and loader', () => {
    expect(parseVersionFilters('1.2.0-1.19.4-forge')).toEqual({
      loader: 'forge',
      mcVersion: '1.19.4',
    })
  })
})

describe('versionsMatchForDisplay', () => {
  it('matches exact same versions', () => {
    expect(versionsMatchForDisplay('1.2.0', '1.2.0', 'unknown')).toBe(true)
  })

  it('treats dash loader suffix as display-equivalent for modrinth/maven/unknown', () => {
    expect(versionsMatchForDisplay('1.2.0-fabric', '1.2.0', 'unknown')).toBe(true)
  })

  it('treats plus filters as display-equivalent for modrinth/maven/unknown', () => {
    expect(versionsMatchForDisplay('0.7.6+1.21+neoforge', '0.7.6', 'modrinth')).toBe(true)
  })

  it('accepts four-segment numeric suffixes in dash syntax', () => {
    expect(versionsMatchForDisplay('1.2.0-26.1.2.4', '1.2.0', 'unknown')).toBe(true)
  })

  it('accepts two-segment mc version suffixes in dash syntax', () => {
    expect(versionsMatchForDisplay('1.2.0-1.21', '1.2.0', 'unknown')).toBe(true)
  })

  it('does not match incompatible latest version formats', () => {
    expect(versionsMatchForDisplay('1.2.0-forge,26.1.2.4', '1.2.0-26.1.2.4', 'unknown')).toBe(false)
  })
})
