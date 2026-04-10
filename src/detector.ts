import type { DependencyGroup, OverrideMap, ParsedDependency, VersionCheckResult } from './types.ts'
import { resolveRepoUrl } from './parser.ts'

// ---------------------------------------------------------------------------
// Source detection from an SPDX package name ("group:artifact")
// ---------------------------------------------------------------------------

/**
 * Extracts the numeric CurseForge project ID from a `curse.maven` artifact name.
 * cursemaven format: `{slug}-{projectId}` — projectId is trailing digits.
 */
function extractCfProjectId(artifact: string): string | null {
  const m = artifact.match(/-(\d+)$/)
  return m ? m[1] : null
}

/**
 * Strips known loader names and MC version suffixes from the end of an artifact
 * name to derive a stable logical base.
 *
 * Examples:
 *   dynamictrees-forge-1.20.1  → dynamictrees
 *   dynamictrees-neoforge-1.21 → dynamictrees
 *   dynamictrees-fabric-1.21   → dynamictrees
 *   jei-238222                 → jei-238222  (no loader/mc suffix)
 */
const LOADER_SUFFIX_RE = /-(forge|neoforge|fabric|quilt|common|lexforge|klf)$/i
const MC_VERSION_RE = /-\d+\.\d+(\.\d+)?$/

function deriveLogicalArtifact(artifact: string): string {
  let base = artifact
  for (let i = 0; i < 4; i++) {
    const prev = base
    base = base.replace(LOADER_SUFFIX_RE, '').replace(MC_VERSION_RE, '')
    if (base === prev) break
  }
  return base || artifact
}

// ---------------------------------------------------------------------------
// Main detection
// ---------------------------------------------------------------------------

/**
 * From an SPDX package `name` field (format: "group:artifact"), detect the
 * appropriate data source and return enough info to build a ParsedDependency.
 *
 * Override map is consulted first so users can correct mis-detected packages.
 *
 * @param spdxName   "group:artifact" from the SPDX packages array
 * @param version    Current version string from the SPDX package
 * @param direct     Whether this is a direct dependency
 * @param repoMap    Group → repo URL map built from build.gradle.kts
 * @param overrides  Per-repo manual override map from KV
 */
export function detectSource(
  spdxName: string,
  version: string,
  direct: boolean,
  repoMap: Map<string, string>,
  overrides: OverrideMap,
): ParsedDependency {
  // The name field may include the version appended after "@" in some SPDX generators.
  const nameOnly = spdxName.split('@')[0]

  const colonIdx = nameOnly.indexOf(':')
  const group = colonIdx !== -1 ? nameOnly.slice(0, colonIdx) : nameOnly
  const artifact = colonIdx !== -1 ? nameOnly.slice(colonIdx + 1) : ''

  const key = `${group}:${artifact}`
  const logicalName = `${group}:${deriveLogicalArtifact(artifact)}`

  // ── 1. Manual override wins ──────────────────────────────────────────────
  const override = overrides[key]
  if (override) {
    const src = override.source

    if (src === 'modrinth') {
      return {
        name: key,
        logicalName,
        source: 'modrinth',
        identifier: override.slug ?? deriveLogicalArtifact(artifact),
        currentVersion: version,
        direct,
      }
    }

    if (src === 'curseforge') {
      return {
        name: key,
        logicalName,
        source: 'curseforge',
        identifier: override.cfProjectId ?? extractCfProjectId(artifact) ?? artifact,
        currentVersion: version,
        direct,
      }
    }

    if (src === 'fabric') {
      return {
        name: key,
        logicalName,
        source: 'fabric',
        identifier: 'fabric-loader',
        currentVersion: version,
        direct,
      }
    }

    if (src === 'maven') {
      return {
        name: key,
        logicalName,
        source: 'maven',
        identifier: key,
        currentVersion: version,
        mavenRepo: override.mavenRepo ?? resolveRepoUrl(group, repoMap),
        direct,
      }
    }
  }

  // ── 2. Auto-detection by group ID ────────────────────────────────────────

  // Modrinth Maven repository
  if (group === 'maven.modrinth') {
    // Modrinth Maven versions are prefixed with the MC version, e.g. "mc1.21.1-0.6.0+build.24".
    // Strip that prefix so the stored currentVersion matches what the Modrinth API returns.
    const normalizedVersion = version.replace(/^mc\d+\.\d+(?:\.\d+)?-/, '')
    return {
      name: key,
      logicalName,
      source: 'modrinth',
      // Use the stripped artifact as the Modrinth project slug
      identifier: deriveLogicalArtifact(artifact),
      currentVersion: normalizedVersion,
      direct,
    }
  }

  // CurseForge via cursemaven proxy
  if (group === 'curse.maven') {
    const projectId = extractCfProjectId(artifact)
    return {
      name: key,
      logicalName,
      source: projectId ? 'curseforge' : 'unknown',
      identifier: projectId ?? artifact,
      currentVersion: version,
      direct,
    }
  }

  // NeoForge — hosted on maven.neoforged.net/releases
  if (group === 'net.neoforged' && artifact === 'neoforge') {
    return {
      name: key,
      logicalName,
      source: 'neoforge',
      identifier: key,
      currentVersion: version,
      mavenRepo: 'https://maven.neoforged.net/releases',
      direct,
    }
  }

  // Forge — hosted on maven.minecraftforge.net
  if (group === 'net.minecraftforge' && artifact === 'forge') {
    return {
      name: key,
      logicalName,
      source: 'forge',
      identifier: key,
      currentVersion: version,
      mavenRepo: 'https://maven.minecraftforge.net',
      direct,
    }
  }

  // Fabric Loader
  if (group === 'net.fabricmc' && artifact === 'fabric-loader') {
    return {
      name: key,
      logicalName,
      source: 'fabric',
      identifier: 'fabric-loader',
      currentVersion: version,
      direct,
    }
  }

  // Fabric API (published on Modrinth as "fabric-api")
  if (group === 'net.fabricmc' && artifact === 'fabric-api') {
    return {
      name: key,
      logicalName,
      source: 'modrinth',
      identifier: 'fabric-api',
      currentVersion: version,
      direct,
    }
  }

  // Generic Maven — resolve the repo URL
  const resolvedRepo = resolveRepoUrl(group, repoMap)

  return {
    name: key,
    logicalName,
    source: resolvedRepo ? 'maven' : 'unknown',
    identifier: key,
    currentVersion: version,
    mavenRepo: resolvedRepo,
    direct,
  }
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/**
 * Groups a flat list of VersionCheckResults by their logicalName.
 * Within each group, variants are sorted alphabetically by name.
 * Groups are sorted: outdated first, then alphabetically by logicalName.
 */
export function groupDeps(deps: VersionCheckResult[]): DependencyGroup[] {
  const map = new Map<string, VersionCheckResult[]>()
  for (const dep of deps) {
    const arr = map.get(dep.logicalName) ?? []
    arr.push(dep)
    map.set(dep.logicalName, arr)
  }

  const groups: DependencyGroup[] = []
  for (const [logicalName, variants] of map) {
    variants.sort((a, b) => a.name.localeCompare(b.name))
    groups.push({
      logicalName,
      source: variants[0].source,
      variants,
      anyOutdated: variants.some(v => v.upToDate === false),
    })
  }

  const LOADER_SOURCES = new Set(['forge', 'neoforge', 'fabric'])
  groups.sort((a, b) => {
    const aLoader = LOADER_SOURCES.has(a.source)
    const bLoader = LOADER_SOURCES.has(b.source)
    if (aLoader !== bLoader) return aLoader ? -1 : 1
    if (a.anyOutdated !== b.anyOutdated) return a.anyOutdated ? -1 : 1
    return a.logicalName.localeCompare(b.logicalName)
  })

  return groups
}
