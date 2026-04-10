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
function parseMavenMetadataXml(xml: string, versionPredicate?: (v: string) => boolean): string | null {
  const allVersions = [...xml.matchAll(/<version>([^<]+)<\/version>/g)].map(m => m[1].trim())

  if (versionPredicate) {
    const filtered = allVersions.filter(versionPredicate)
    return filtered[filtered.length - 1] ?? null
  }

  // Prefer <latest> (most-recently deployed, may be SNAPSHOT) over <release>
  // so that snapshot-only repos (e.g. maven.lenni0451.net/snapshots) return
  // the correct newest version even when version list order is not sequential.
  const latestMatch = xml.match(/<latest>([^<]+)<\/latest>/)
  if (latestMatch) return latestMatch[1].trim()

  const releaseMatch = xml.match(/<release>([^<]+)<\/release>/)
  if (releaseMatch) return releaseMatch[1].trim()

  return allVersions[allVersions.length - 1] ?? null
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
  const groupPath = group.replaceAll('.', '/')
  const base = repoUrl.replace(/\/$/, '')

  // Helper that fetches maven-metadata.xml for a given artifact path segment
  const fetchMetadata = async (artifactSegment: string): Promise<string | null> => {
    const url = `${base}/${groupPath}/${artifactSegment}/maven-metadata.xml`
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'modding-versioning/1.0' },
      })
      if (!res.ok) return null
      return parseMavenMetadataXml(await res.text(), versionPredicate)
    } catch {
      return null
    }
  }

  // First try with the original artifact name as-is
  const v = await fetchMetadata(artifact)
  if (v !== null) return v

  // If the artifact name contains uppercase letters, try an all-lowercase fallback.
  // This handles packages that have been renamed to all-lowercase (e.g. the
  // net.lenni0451 ClassTransform family: ClassTransform-AdditionalClassProvider →
  // additionalclassprovider under net.lenni0451.classtransform).
  const lower = artifact.toLowerCase()
  if (lower !== artifact) return fetchMetadata(lower)

  return null
}

interface MavenSearchDoc {
  latestVersion?: string
  v?: string
}

interface MavenSearchResponse {
  response?: { docs?: MavenSearchDoc[] }
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
