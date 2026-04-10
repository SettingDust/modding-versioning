interface GitHubContentsResponse {
  content?: string
  encoding?: string
  message?: string
}

// ---------------------------------------------------------------------------
// SBOM (Software Bill of Materials) via GitHub Dependency Graph API
// ---------------------------------------------------------------------------

export interface SpdxPackage {
  SPDXID: string
  name: string         // "group:artifact", e.g. "maven.modrinth:fabric-api"
  versionInfo: string  // current version string
  externalRefs?: Array<{
    referenceCategory: string
    referenceType: string
    referenceLocator: string
  }>
}

export interface SpdxRelationship {
  spdxElementId: string      // "SPDXRef-Repository" for direct deps
  relationshipType: string   // "DEPENDS_ON"
  relatedSpdxElement: string // SPDXID of the dependent package
}

interface SbomResponse {
  sbom: {
    packages: SpdxPackage[]
    relationships: SpdxRelationship[]
  }
}

export interface SbomResult {
  packages: SpdxPackage[]
  /** Set of SPDXID values that are direct (not transitive) dependencies */
  directIds: Set<string>
}

/**
 * Fetches the GitHub Dependency Graph SBOM for a repository.
 * Returns null when the SBOM is unavailable (feature not enabled, private repo
 * without the right token scope, etc.).
 */
export async function fetchSbom(
  owner: string,
  repo: string,
  token?: string,
): Promise<SbomResult | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/dependency-graph/sbom`

  const headers: Record<string, string> = {
    'User-Agent': 'modding-versioning/1.0',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, { headers })

  if (res.status === 404 || res.status === 403) return null
  if (!res.ok) {
    throw new Error(`GitHub SBOM API ${res.status} for ${owner}/${repo}`)
  }

  const data = (await res.json()) as SbomResponse
  const { packages, relationships } = data.sbom

  // Filter out the repo-root placeholder package (not a real dependency)
  const deps = packages.filter(p => p.SPDXID !== 'SPDXRef-Repository' && p.name !== 'SPDXRef-Repository')

  // Level 1: standard — SPDXRef-Repository DEPENDS_ON <direct dep>
  let directIds = new Set<string>(
    relationships
      .filter(r => r.spdxElementId === 'SPDXRef-Repository' && r.relationshipType === 'DEPENDS_ON')
      .map(r => r.relatedSpdxElement),
  )

  // Level 2: topology-based root detection.
  // Some repos (e.g. using the GitHub Dependency Graph Gradle Plugin) produce SBOMs
  // where the root element is NOT "SPDXRef-Repository". We detect the true root(s)
  // by finding DEPENDS_ON sources that are never themselves a DEPENDS_ON target.
  if (directIds.size === 0) {
    const dependsOnRels = relationships.filter(r => r.relationshipType === 'DEPENDS_ON')
    if (dependsOnRels.length > 0) {
      const allTargets = new Set(dependsOnRels.map(r => r.relatedSpdxElement))
      const rootSources = dependsOnRels
        .map(r => r.spdxElementId)
        .filter(id => !allTargets.has(id))
      if (rootSources.length > 0) {
        const rootSourceSet = new Set(rootSources)
        directIds = new Set(
          dependsOnRels
            .filter(r => rootSourceSet.has(r.spdxElementId))
            .map(r => r.relatedSpdxElement),
        )
      }
    }
  }

  // Level 3: fallback — treat all packages as direct deps rather than showing nothing
  if (directIds.size === 0) {
    deps.forEach(p => directIds.add(p.SPDXID))
  }

  return { packages: deps, directIds }
}

/**
 * Fetches the raw text content of a file from a public (or accessible) GitHub repository.
 * Returns null if the file does not exist (404) or is not a regular file.
 */
export async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  token?: string,
): Promise<string | null> {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`

  const headers: Record<string, string> = {
    'User-Agent': 'modding-versioning/1.0',
    Accept: 'application/vnd.github.v3+json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url, { headers })

  if (res.status === 404) return null
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} for ${owner}/${repo}/${path}`)
  }

  const data = (await res.json()) as GitHubContentsResponse
  if (!data.content) return null

  // GitHub returns base64-encoded content with embedded newlines.
  const base64 = data.content.replace(/\n/g, '')
  return atob(base64)
}
