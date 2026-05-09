import { describe, expect, it } from 'vitest'
import { detectSource, normalizeModrinthMavenVersion } from '../detector.ts'

describe('normalizeModrinthMavenVersion', () => {
  it('normalizes legacy mc-prefixed Modrinth Maven versions', () => {
    expect(normalizeModrinthMavenVersion('mc1.21.1-0.6.0+build.24')).toBe('0.6.0+build.24')
  })

  it('strips +mc+loader filters from modern versions', () => {
    expect(normalizeModrinthMavenVersion('0.7.6+1.21+neoforge')).toBe('0.7.6')
  })

  it('strips +mc filter when loader is omitted', () => {
    expect(normalizeModrinthMavenVersion('0.7.6+1.21')).toBe('0.7.6')
  })

  it('keeps plain semantic versions unchanged', () => {
    expect(normalizeModrinthMavenVersion('1.2.0')).toBe('1.2.0')
  })

  it('keeps four-segment loader variants intact when not in + filter syntax', () => {
    expect(normalizeModrinthMavenVersion('26.1.2.4-fabric')).toBe('26.1.2.4-fabric')
  })
})

describe('detectSource for maven.modrinth', () => {
  it('uses normalized currentVersion for +mc+loader variants', () => {
    const dep = detectSource('maven.modrinth:example-mod', '0.7.6+1.21+neoforge', true, new Map(), {})

    expect(dep.source).toBe('modrinth')
    expect(dep.identifier).toBe('example-mod')
    expect(dep.currentVersion).toBe('0.7.6')
  })

  it('uses normalized currentVersion for legacy mc-prefixed variants', () => {
    const dep = detectSource('maven.modrinth:example-mod', 'mc1.21.1-0.6.0+build.24', true, new Map(), {})

    expect(dep.source).toBe('modrinth')
    expect(dep.identifier).toBe('example-mod')
    expect(dep.currentVersion).toBe('0.6.0+build.24')
  })
})
