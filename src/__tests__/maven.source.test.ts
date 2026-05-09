import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLatestMavenVersionWithReason } from '../sources/maven.ts'

describe('getLatestMavenVersionWithReason', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns latest version from metadata latest/release tags', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => `<metadata><versioning><latest>1.2.3</latest><release>1.2.2</release></versioning></metadata>`,
    })))

    const result = await getLatestMavenVersionWithReason('https://repo.example.com', 'com.example', 'demo')

    expect(result.version).toBe('1.2.3')
    expect(result.error).toBeNull()
  })

  it('returns a traceable error when metadata endpoint is missing', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
      text: async () => 'Not Found',
    })))

    const result = await getLatestMavenVersionWithReason('https://repo.example.com', 'settingdust.preloading_tricks', 'PreloadingTricks')

    expect(result.version).toBeNull()
    expect(result.error).toContain('maven-metadata.xml not found')
    expect(result.error).toContain('/settingdust/preloading_tricks/PreloadingTricks/maven-metadata.xml')
  })

  it('returns a traceable error when metadata has no usable versions', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '<metadata><versioning></versioning></metadata>',
    })))

    const result = await getLatestMavenVersionWithReason('https://repo.example.com', 'settingdust.preloading_tricks', 'PreloadingTricks')

    expect(result.version).toBeNull()
    expect(result.error).toContain('no versions found in maven-metadata.xml')
  })
})
