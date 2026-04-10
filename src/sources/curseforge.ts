import type { ProjectContext } from '../types.ts'

interface CurseForgeFile {
  id: number
  displayName: string
  fileName: string
  fileDate: string
}

interface CurseForgeResponse {
  data?: CurseForgeFile[]
}

/**
 * CurseForge modLoaderType enum values.
 * https://docs.curseforge.com/#tocS_ModLoaderType
 */
const CF_LOADER: Record<string, number> = {
  forge:    1,
  fabric:   4,
  quilt:    5,
  neoforge: 6,
}

/**
 * Returns the display name of the most recent CurseForge file compatible with
 * the given ProjectContext (Minecraft version + first detected loader).
 * The API key is supplied by the Worker environment and never exposed to clients.
 */
export async function getLatestCurseForgeVersion(
  projectId: string | number,
  apiKey: string,
  ctx?: ProjectContext,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      pageSize: '1',
      sortField: '5',
      sortOrder: 'desc',
    })
    if (ctx?.mcVersion) {
      params.set('gameVersion', ctx.mcVersion)
    }
    if (ctx?.loaders?.length) {
      const loaderType = CF_LOADER[ctx.loaders[0].toLowerCase()]
      if (loaderType !== undefined) {
        params.set('modLoaderType', String(loaderType))
      }
    }

    const res = await fetch(
      `https://api.curseforge.com/v1/mods/${projectId}/files?${params}`,
      {
        headers: {
          'x-api-key': apiKey,
          'User-Agent': 'modding-versioning/1.0',
          Accept: 'application/json',
        },
      },
    )
    if (!res.ok) return null

    const data = (await res.json()) as CurseForgeResponse
    return data.data?.[0]?.displayName ?? null
  } catch {
    return null
  }
}
