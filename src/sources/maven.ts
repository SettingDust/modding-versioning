/**
 * Parses a maven-metadata.xml string and returns the latest release version.
 *
 * When `versionPredicate` is given, all <version> elements are filtered through
 * it and the last matching entry is returned (used to restrict results to a
 * specific loader variant, e.g. only "+forge" versions).
 *
 * Without a predicate: prefers the <release> element; falls back to the last
 * <version> in the list.
 */
interface MavenMetadataParseResult {
  version: string | null
  error: string | null
}

export interface MavenLookupResult {
  version: string | null
  error: string | null
}

function parseMavenMetadataXmlWithReason(xml: string, versionPredicate?: (v: string) => boolean): MavenMetadataParseResult {
  const allVersions = [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map(m => m[1].trim())

  if (versionPredicate) {
    const filtered = allVersions.filter(versionPredicate)
    const version = filtered[filtered.length - 1] ?? null
    if (version) return { version, error: null }
    return { version: null, error: 'no versions matched version filter in maven-metadata.xml' }
  }

  // Prefer <latest> (most-recently deployed, may be SNAPSHOT) over <release>
  // so that snapshot-only repos (e.g. maven.lenni0451.net/snapshots) return
  // the correct newest version even when version list order is not sequential.
  const latestMatch = xml.match(/<latest>([^<]+)<\/latest>/)
  if (latestMatch) return { version: latestMatch[1].trim(), error: null }

  const releaseMatch = xml.match(/<release>([^<]+)<\/release>/)
  if (releaseMatch) return { version: releaseMatch[1].trim(), error: null }

  const fallbackVersion = allVersions[allVersions.length - 1] ?? null
  if (fallbackVersion) return { version: fallbackVersion, error: null }

  return { version: null, error: 'no versions found in maven-metadata.xml' }
}

/**
 * Fetches maven-metadata.xml from the specified Maven repository and returns
 * the latest release version for the given group:artifact.
 *
 * Works for any standard Maven 2 repository, including:
 *   - maven.neoforged.net/releases  (NeoForge)
 *   - maven.lenni0451.net/snapshots
 *   - repo1.maven.org/maven2        (Maven Central)
 *   - Any custom Maven repo declared in the Gradle build script
 */
export async function getLatestMavenVersion(
  repoUrl: string,
  group: string,
  artifact: string,
  versionPredicate?: (v: string) => boolean,
): Promise<string | null> {
  const result = await getLatestMavenVersionWithReason(repoUrl, group, artifact, versionPredicate)
  return result.version
}

/**
 * Same lookup as getLatestMavenVersion, but returns a traceable error reason
 * when metadata lookup fails or contains no usable versions.
 */
export async function getLatestMavenVersionWithReason(
  repoUrl: string,
  group: string,
  artifact: string,
  versionPredicate?: (v: string) => boolean,
): Promise<MavenLookupResult> {
  const groupPath = group.replaceAll('.', '/')
  const base = repoUrl.replace(/\/$/, '')

  // Helper that fetches maven-metadata.xml for a given artifact path segment
  const fetchMetadata = async (artifactSegment: string): Promise<MavenLookupResult> => {
    const tryUrl = async (metaFile: string): Promise<MavenLookupResult & { notFound?: boolean }> => {
      const url = `${base}/${groupPath}/${artifactSegment}/${metaFile}`
      try {
        const res = await fetch(url, { headers: { 'User-Agent': 'modding-versioning/1.0' } })
        if (!res.ok) {
          if (res.status === 404) return { version: null, error: `${metaFile} not found: ${url}`, notFound: true }
          return { version: null, error: `failed to fetch ${metaFile} (${res.status}): ${url}` }
        }
        const parsed = parseMavenMetadataXmlWithReason(await res.text(), versionPredicate)
        if (parsed.version) return { version: parsed.version, error: null }
        return { version: null, error: parsed.error ? `${parsed.error}: ${url}` : `unable to resolve latest version from metadata: ${url}` }
      } catch {
        return { version: null, error: `request failed for ${metaFile}: ${url}` }
      }
    }

    const primary = await tryUrl('maven-metadata.xml')
    if (primary.version !== null) return primary
    if (primary.notFound) {
      const local = await tryUrl('maven-metadata-local.xml')
      if (local.version !== null) return local
      return { version: null, error: [primary.error, local.error].filter(Boolean).join(' | ') || null }
    }
    return primary
  }

  // First try with the original artifact name as-is
  const directResult = await fetchMetadata(artifact)
  if (directResult.version !== null) return directResult

  // If the artifact name contains uppercase letters, try an all-lowercase fallback.
  // This handles packages that have been renamed to all-lowercase (e.g. the
  // net.lenni0451 ClassTransform family: ClassTransform-AdditionalClassProvider →
  // additionalclassprovider under net.lenni0451.classtransform).
  const lower = artifact.toLowerCase()
  if (lower !== artifact) {
    const lowerResult = await fetchMetadata(lower)
    if (lowerResult.version !== null) return lowerResult
    return {
      version: null,
      error: [directResult.error, lowerResult.error].filter(Boolean).join(' | ') || null,
    }
  }

  return directResult
}

interface MavenSearchDoc {
  latestVersion?: string
  v?: string
}

interface MavenSearchResponse {
  response?: { docs?: MavenSearchDoc[] }
}

export function combineVersionPredicates(
  ...predicates: Array<((value: string) => boolean) | undefined>
): ((value: string) => boolean) | undefined {
  const active = predicates.filter((predicate): predicate is (value: string) => boolean => typeof predicate === 'function')
  if (!active.length) return undefined
  return (value: string) => active.every(predicate => predicate(value))
}

/**
 * Searches Maven Central via the Sonatype search API.
 * Used as a fallback when no specific repository URL is known for a group.
 */
export async function searchMavenCentral(
  group: string,
  artifact: string,
): Promise<string | null> {
  const q = encodeURIComponent(`g:${group} AND a:${artifact}`)
  const url = `https://search.maven.org/solrsearch/select?q=${q}&rows=1&wt=json`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'modding-versioning/1.0' },
    })
    if (!res.ok) return null

    const data = (await res.json()) as MavenSearchResponse
    const doc = data.response?.docs?.[0]
    return doc?.latestVersion ?? doc?.v ?? null
  } catch {
    return null
  }
}
