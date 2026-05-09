import { describe, expect, it } from 'vitest'
import { buildFallbackRepos, buildRepoMapping, resolveRepoUrl } from '../parser.ts'

describe('buildFallbackRepos', () => {
  it('collects repositories declared with maven { url = uri(...) } syntax', () => {
    const content = `
repositories {
  maven {
    url = uri("https://maven.example.com/releases")
  }
  mavenCentral()
}
`

    expect(buildFallbackRepos(content)).toEqual([
      'https://maven.example.com/releases',
      'https://repo1.maven.org/maven2',
    ])
  })
})

describe('buildRepoMapping', () => {
  it('maps includeGroup declarations for block-style maven repositories', () => {
    const content = `
repositories {
  maven {
    url = uri("https://maven.shedaniel.me")
    content {
      includeGroup("me.shedaniel")
      includeGroupAndSubgroups("dev.architectury")
    }
  }
}
`

    const map = buildRepoMapping(content)

    expect(resolveRepoUrl('me.shedaniel', map)).toBe('https://maven.shedaniel.me')
    expect(resolveRepoUrl('dev.architectury.injectables', map)).toBe('https://maven.shedaniel.me')
  })
})
