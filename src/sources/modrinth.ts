import type { ProjectContext } from '../types.ts'

interface ModrinthVersion {
  version_number: string
  date_published: string
}

/** Loader names that the Modrinth API actually recognises. */
const MODRINTH_LOADERS = new Set([
  'forge', 'neoforge', 'fabric', 'quilt', 'liteloader', 'modloader', 'rift', 'bukkit',
])

/**
 * Returns the latest version of a Modrinth project compatible with the given
 * ProjectContext (Minecraft version + loaders). When no context is supplied,
 * returns the globally most-recent version.
 */
export async function getLatestModrinthVersion(
  slug: string,
  ctx?: ProjectContext,
): Promise<string | null> {
  try {
    const params = new URLSearchParams()
    if (ctx?.mcVersion) {
      params.set('game_versions', JSON.stringify([ctx.mcVersion]))
    }
    // Only pass loaders that Modrinth recognises; skip platform-internal names like
    // 'common', 'lexforge', 'klf' to avoid empty result sets.
    const modrinthLoaders = (ctx?.loaders ?? []).filter(l => MODRINTH_LOADERS.has(l))
    if (modrinthLoaders.length) {
      params.set('loaders', JSON.stringify(modrinthLoaders))
    }
    const qs = params.toString()
    const url = `https://api.modrinth.com/v2/project/${slug}/version${qs ? '?' + qs : ''}`

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'modding-versioning/1.0 (github.com/modding-versioning)',
        Accept: 'application/json',
      },
    })
    if (!res.ok) return null

    const versions = (await res.json()) as ModrinthVersion[]
    return versions[0]?.version_number ?? null
  } catch {
    return null
  }
}
