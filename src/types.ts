export interface Env {
  VERSION_CACHE: KVNamespace
  GITHUB_TOKEN?: string
  CURSEFORGE_API_KEY?: string
  ACCESS_TOKEN?: string
  /** Set to "true" to require ACCESS_TOKEN on /api/check */
  PARSE_REQUIRES_AUTH?: string
}

export interface RepoEntry {
  owner: string
  repo: string
  addedAt: string
}

export type DependencySource = 'modrinth' | 'curseforge' | 'fabric' | 'forge' | 'neoforge' | 'maven' | 'unknown'

export interface DeclaredDep {
  /** "group:artifact" */
  name: string
  /** Path to the file that declared this dep, e.g. "gradle/libs.versions.toml" */
  file: string
  /** 1-based line number */
  line: number
}

export interface ParsedDependency {
  /** "group:artifact" from SPDX package name */
  name: string
  /**
   * The logical base name shared across multi-version variants.
   * e.g. "maven.modrinth:dynamictrees-forge-1.20" → logicalName "maven.modrinth:dynamictrees"
   * For single-version deps this equals `name`.
   */
  logicalName: string
  source: DependencySource
  /**
   * Source-specific identifier for version queries:
   * - modrinth:    project slug
   * - curseforge:  numeric project ID (string)
   * - fabric:      "fabric-loader"
   * - maven:       "group:artifact"
   * - unknown:     "group:artifact"
   */
  identifier: string
  currentVersion: string
  /** Resolved Maven repository base URL (maven source only) */
  mavenRepo?: string
  /** True for direct deps; false for transitive */
  direct: boolean
  /** Where in the build scripts this dep was explicitly declared */
  declaredIn?: { file: string; line: number }
}

export interface VersionCheckResult extends ParsedDependency {
  latestVersion: string | null
  /** null when latestVersion could not be fetched */
  upToDate: boolean | null
}

export interface ProjectContext {
  /** Detected Minecraft version, e.g. "1.21.1" — null if not found */
  mcVersion: string | null
  /** Detected mod loaders inferred from SBOM packages, e.g. ["fabric"], ["neoforge"] */
  loaders: string[]
  /** Version string for each detected loader, keyed by loader name */
  loaderVersions: Record<string, string>
}

/**
 * Multiple variants of the same logical dependency grouped together.
 * e.g. dynamictrees for 1.20 forge + 1.21 neoforge + 1.21 fabric.
 */
export interface DependencyGroup {
  /** Shared logical name across all variants */
  logicalName: string
  source: DependencySource
  /** Individual per-variant results, sorted by name */
  variants: VersionCheckResult[]
  /** True if any variant is outdated */
  anyOutdated: boolean
}

export interface CheckResult {
  context: ProjectContext
  /** Dependencies grouped by logical name */
  groups: DependencyGroup[]
}

/** Stored in KV under `overrides:{owner}/{repo}` as a JSON object */
export type OverrideMap = Record<
  string, // "group:artifact" key
  {
    source: DependencySource
    /** Maven repo URL (when source = "maven") */
    mavenRepo?: string
    /** Modrinth project slug (when source = "modrinth") */
    slug?: string
    /** CurseForge numeric project id as string (when source = "curseforge") */
    cfProjectId?: string
  }
>
