import { describe, expect, it } from 'vitest'
import { parseMcVersion } from '../parser.ts'

describe('parseMcVersion', () => {
  it('reads minecraft_version from gradle.properties', () => {
    const gradleProps = 'minecraft_version = 1.21.1\nother_key = value'
    expect(parseMcVersion(gradleProps, null)).toBe('1.21.1')
  })

  it('falls back to build.gradle.kts when gradle.properties is missing', () => {
    const buildKts = 'val mcVersion = "1.20.1"\n'
    expect(parseMcVersion(null, buildKts)).toBe('1.20.1')
  })
})
