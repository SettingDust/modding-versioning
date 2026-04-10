interface FabricLoaderVersion {
  version: string
  stable: boolean
}

/**
 * Returns the latest stable Fabric Loader version.
 * Falls back to the first entry if no stable version is listed.
 */
export async function getLatestFabricLoader(): Promise<string | null> {
  try {
    const res = await fetch('https://meta.fabricmc.net/v2/versions/loader', {
      headers: { 'User-Agent': 'modding-versioning/1.0' },
    })
    if (!res.ok) return null

    const versions = (await res.json()) as FabricLoaderVersion[]
    const stable = versions.find((v) => v.stable)
    return stable?.version ?? versions[0]?.version ?? null
  } catch {
    return null
  }
}
