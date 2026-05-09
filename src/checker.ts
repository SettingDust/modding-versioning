import type { CheckResult, DeclaredDep, Env, ProjectContext, VersionCheckResult } from './types.ts'
import { fetchFileContent, fetchSbom } from './github.ts'
import type { SpdxPackage } from './github.ts'
import { buildFallbackRepos, buildRepoMapping, parseDeclaredDeps, parseDeclaredGroups, parseDependencyBlocks, parseMcVersion, parseVersionCatalog, resolveRepoUrl } from './parser.ts'
import { detectSource, groupDeps } from './detector.ts'
import { getOverrides } from './overrides.ts'
import { cachedFetch } from './cache.ts'
import { getLatestFabricLoader } from './sources/fabric.ts'
import { getLatestMavenVersionWithReason } from './sources/maven.ts'
import { combineVersionPredicates } from './sources/maven.ts'
import { getLatestModrinthVersion } from './sources/modrinth.ts'
import { getLatestCurseForgeVersion } from './sources/curseforge.ts'

const RESULT_CACHE_VERSION = 'v3'
const VERSION_CACHE_VERSION = 'v3'

const VERSION_FILTER_LOADERS = new Set(['forge', 'neoforge', 'fabric', 'quilt', 'liteloader', 'lexforge', 'common', 'klf'])

interface ResolvedVersionInfo {
  version: string | null
  resolvedRepo?: string
  error?: string | null
}

interface ParsedVersionFilters {
  loader: string | null
  mcVersion: string | null
}

const FILTER_LOADERS_RE = /^(forge|neoforge|fabric|quilt|liteloader|lexforge|common|klf)$/i
const MC_VER_RE = /^1\.\d+(?:\.\d+)?$/
function normalizeFilterToken(token: string): string {
  return token.trim().toLowerCase()
}

function parseFilterTokens(tokens: string[]): ParsedVersionFilters {
  const normalized = tokens.map(normalizeFilterToken).filter(Boolean)
  const loader = normalized.find(token => FILTER_LOADERS_RE.test(token)) ?? null
  const mcVersion = normalized.find(token => MC_VER_RE.test(token)) ?? null
  return { loader, mcVersion }
}

function parsePlusFilters(version: string): ParsedVersionFilters {
  const plusIdx = version.indexOf('+')
  if (plusIdx === -1) return { loader: null, mcVersion: null }
  const plusTokens = version.slice(plusIdx + 1).split('+')
  return parseFilterTokens(plusTokens)
}

function parseDashFilters(version: string): ParsedVersionFilters {
  const dashIdx = version.indexOf('-')
  if (dashIdx === -1) return { loader: null, mcVersion: null }
  const dashTokens = version
    .slice(dashIdx + 1)
    .split(/[,-]/)
  return parseFilterTokens(dashTokens)
}

export function parseVersionFilters(version: string): ParsedVersionFilters {
  const plus = parsePlusFilters(version)

  // Priority: +MC+loader > +MC > +loader > dash-based filters.
  if (plus.loader && plus.mcVersion) return plus
  if (plus.mcVersion) return { loader: null, mcVersion: plus.mcVersion }
  if (plus.loader) return { loader: plus.loader, mcVersion: null }

  return parseDashFilters(version)
}

function extractTrailingLoaderTag(version: string): string | null {
  const plus = parsePlusFilters(version)
  if (plus.loader) return plus.loader

  const dash = parseDashFilters(version)
  return dash.loader
}

export function versionsMatchForDisplay(
  currentVersion: string,
  latestVersion: string,
  source: VersionCheckResult['source'],
): boolean {
  if (currentVersion === latestVersion) return true

  // Some upstreams encode loader filters in the resolved version string while the
  // latest upstream version omits them, e.g. "1.2.0-fabric" vs "1.2.0".
  if (source === 'modrinth' || source === 'maven' || source === 'unknown') {
    if (currentVersion.startsWith(`${latestVersion}-`)) {
      const suffix = currentVersion.slice(latestVersion.length + 1)
      const suffixTokens = suffix.split(',').map(token => token.trim()).filter(Boolean)
      if (suffixTokens.length > 0 && suffixTokens.every(token => VERSION_FILTER_LOADERS.has(token) || /^\d+\.\d+(?:\.\d+)*$/.test(token))) {
        return true
      }
    }

    if (currentVersion.startsWith(`${latestVersion}+`)) {
      const suffix = currentVersion.slice(latestVersion.length + 1)
      const suffixTokens = suffix.split('+').map(token => token.trim().toLowerCase()).filter(Boolean)
      if (suffixTokens.length > 0 && suffixTokens.every(token => VERSION_FILTER_LOADERS.has(token) || MC_VER_RE.test(token))) {
        return true
      }
    }
  }

  return false
}

// ---------------------------------------------------------------------------
// Loader inference from SBOM packages
// ---------------------------------------------------------------------------

/** Package name patterns that identify a specific mod loader. */
const LOADER_PATTERNS: Array<[RegExp, string]> = [
  [/^net\.fabricmc:fabric-loader/, 'fabric'],
  [/^org\.quiltmc:quilt-loader/, 'quilt'],
  [/^net\.neoforged:neoforge/, 'neoforge'],
  [/^net\.minecraftforge:forge/, 'forge'],
]

/**
 * Infers which mod loaders are present from the list of SBOM packages and also
 * extracts their version strings.
 *
 * For Forge, the version string is `mcVersion-loaderVersion` (e.g. `1.20.1-47.4.4`);
 * we strip the leading `mcVersion-` prefix so that only the meaningful loader
 * version is stored.
 */
function inferLoaders(packages: SpdxPackage[]): { loaders: string[]; loaderVersions: Record<string, string> } {
  const found = new Map<string, string>()
  for (const pkg of packages) {
    for (const [re, loader] of LOADER_PATTERNS) {
      if (re.test(pkg.name)) {
        if (!found.has(loader)) {
          // Strip leading "mcVersion-" prefix that Forge uses (e.g. "1.20.1-47.4.4" → "47.4.4")
          const v = pkg.versionInfo.replace(/^\d+\.\d+(?:\.\d+)?-/, '')
          found.set(loader, v)
        }
        break
      }
    }
  }
  return { loaders: [...found.keys()], loaderVersions: Object.fromEntries(found) }
}

// ---------------------------------------------------------------------------
// Per-dependency Modrinth context extraction
// ---------------------------------------------------------------------------

/**
 * For a `maven.modrinth` package, determines the Modrinth query context
 * (loader + MC version) by inspecting two sources in priority order:
 *
 *  1. Artifact name suffix  e.g. `dynamictrees-forge-1.20.1`
 *     → loader=forge, mcVersion=1.20.1
 *
 *  2. Modrinth Maven version filter syntax  e.g. `1.2.0-fabric`  or `3.0.9-fabric,1.20.2`
 *     The version coordinate can have a dash-separated filter list containing loader
 *     names and/or MC version strings.  When this is the only source of loader info
 *     we intentionally do NOT pass an mcVersion filter to the API — the dep may
 *     legitimately target an older MC version than the rest of the project.
 *
 * Falls back to the project-wide context when neither source yields useful info.
 */
function extractModrinthDepContext(
  depName: string,
  currentVersion: string,
  fallbackCtx: ProjectContext,
): ProjectContext {
  const colonIdx = depName.indexOf(':')
  if (colonIdx === -1) return fallbackCtx

  const artifact = depName.slice(colonIdx + 1)

  // ── Source 1: artifact name ──────────────────────────────────────────────
  // Extract trailing MC version, e.g. "-1.20.1" at the end
  const mcVerMatch = artifact.match(/-(\d+\.\d+(?:\.\d+)?)$/)
  const mcVersion = mcVerMatch ? mcVerMatch[1] : fallbackCtx.mcVersion

  // Strip MC version then look for loader suffix
  const withoutMc = mcVerMatch ? artifact.slice(0, -mcVerMatch[0].length) : artifact
  const loaderMatch = withoutMc.match(/-(forge|neoforge|fabric|quilt|common|lexforge|klf)$/i)

  if (loaderMatch) {
    return { mcVersion, loaders: [loaderMatch[1].toLowerCase()], loaderVersions: fallbackCtx.loaderVersions }
  }

  // ── Source 2: Modrinth Maven version filter syntax ───────────────────────
  // Supports both "-" and "+" separators.
  // E.g. "1.2.0-fabric", "3.0.9-fabric,1.20.2", "0.7.6+1.21+neoforge", "1.2.0+fabric".
  const parsed = parseVersionFilters(currentVersion)
  if (parsed.loader || parsed.mcVersion) {
    return {
      mcVersion: parsed.mcVersion,
      loaders: parsed.loader ? [parsed.loader] : [],
      loaderVersions: fallbackCtx.loaderVersions,
    }
  }

  // ── Source 3: project-wide fallback ─────────────────────────────────────
  return { mcVersion, loaders: fallbackCtx.loaders, loaderVersions: fallbackCtx.loaderVersions }
}

// ---------------------------------------------------------------------------
// Per-dependency latest-version resolver
// ---------------------------------------------------------------------------

async function resolveLatestVersion(
  dep: VersionCheckResult,
  env: Env,
  ctx: ProjectContext,
  fallbackRepos: string[],
): Promise<ResolvedVersionInfo> {
  const cache = env.VERSION_CACHE
  // Include context and dep-specific coordinates in cache key.
  // This avoids cross-pollinating results between same identifier queried in
  // different contexts (e.g. different currentVersion suffixes or mapped repos).
  const ctxSuffix = `${ctx.mcVersion ?? ''}:${ctx.loaders.join(',')}`
  const cacheKey = `version:${VERSION_CACHE_VERSION}:${dep.source}:${dep.identifier}:${dep.currentVersion}:${dep.mavenRepo ?? ''}:${ctxSuffix}`
  const TTL = 3600 // 1 hour

  return cachedFetch<ResolvedVersionInfo>(cache, cacheKey, TTL, async () => {
    switch (dep.source) {
      case 'fabric':
        return { version: await getLatestFabricLoader() }

      case 'modrinth': {
        // Use per-dep loader + MC version extracted from artifact name / version filter
        const depCtx = extractModrinthDepContext(dep.name, dep.currentVersion, ctx)
        return { version: await getLatestModrinthVersion(dep.identifier, depCtx) }
      }

      case 'curseforge': {
        if (!env.CURSEFORGE_API_KEY) return { version: null }
        return { version: await getLatestCurseForgeVersion(dep.identifier, env.CURSEFORGE_API_KEY, ctx) }
      }

      case 'forge':
      case 'neoforge':
      case 'maven': {
        const colonIdx = dep.identifier.indexOf(':')
        if (colonIdx === -1) return { version: null, error: `Invalid Maven coordinate: ${dep.identifier}` }
        const group = dep.identifier.slice(0, colonIdx)
        const artifact = dep.identifier.slice(colonIdx + 1)
        // If the current version has a "+loader" suffix (e.g. "2.10.6-k2.2.21-2.0+forge"),
        // only consider maven metadata versions with the same loader suffix.
        // This prevents picking up a neoforge-tagged version as "latest" for a forge dep
        // when both loader variants share the same Maven artifact coordinates.
        const extractedLoader = extractTrailingLoaderTag(dep.currentVersion)
        let versionFilter: ((v: string) => boolean) | undefined = extractedLoader
          ? (v: string) => extractTrailingLoaderTag(v) === extractedLoader
          : undefined

        // For Forge / NeoForge, each MC version has its own versioning series.
        // Filter to only versions that belong to the same MC release so we don't
        // surface a newer-MC loader version as an available update.
        if (!versionFilter) {
          if (group === 'net.minecraftforge') {
            // Forge: "1.20.1-47.4.4" → only versions starting with "1.20.1-"
            const mcPrefix = dep.currentVersion.match(/^(\d+\.\d+(?:\.\d+)?)-/)?.[1]
            if (mcPrefix) versionFilter = (v) => v.startsWith(`${mcPrefix}-`)
          } else if (group === 'net.neoforged') {
            // NeoForge: "21.1.192" → MC 1.21.1 → only versions starting with "21.1."
            const parts = dep.currentVersion.split('.')
            if (parts.length >= 2) {
              const neoPrefix = `${parts[0]}.${parts[1]}.`
              versionFilter = (v) => v.startsWith(neoPrefix)
            }
          }
        }
        versionFilter = combineVersionPredicates(versionFilter)

        const errors: string[] = []
        const probeRepo = async (repo: string): Promise<ResolvedVersionInfo | null> => {
          const result = await getLatestMavenVersionWithReason(repo, group, artifact, versionFilter)
          if (result.version !== null) return { version: result.version, resolvedRepo: repo, error: null }
          if (result.error) errors.push(`[${repo}] ${result.error}`)
          return null
        }

        // Try the explicitly mapped repo first
        if (dep.mavenRepo) {
          const probed = await probeRepo(dep.mavenRepo)
          if (probed) return probed
        }
        // Fall through to probe build-script repos below
        for (const repo of fallbackRepos) {
          if (repo === dep.mavenRepo) continue
          const probed = await probeRepo(repo)
          if (probed) return probed
        }
        if (!errors.length) {
          return { version: null, error: `No Maven repository produced metadata for ${group}:${artifact}` }
        }
        return { version: null, error: errors.join(' | ') }
      }

      case 'unknown': {
        // No source detected — probe all build-script repos as a best-effort fallback
        if (!fallbackRepos.length) {
          return { version: null, error: `No fallback repositories discovered for ${dep.identifier}` }
        }
        const colonIdx = dep.identifier.indexOf(':')
        if (colonIdx === -1) return { version: null, error: `Invalid Maven coordinate: ${dep.identifier}` }
        const group = dep.identifier.slice(0, colonIdx)
        const artifact = dep.identifier.slice(colonIdx + 1)
        const extractedLoader = extractTrailingLoaderTag(dep.currentVersion)
        const versionFilter = extractedLoader
          ? (v: string) => extractTrailingLoaderTag(v) === extractedLoader
          : undefined
        const finalVersionFilter = combineVersionPredicates(versionFilter)
        const errors: string[] = []
        for (const repo of fallbackRepos) {
          const result = await getLatestMavenVersionWithReason(repo, group, artifact, finalVersionFilter)
          if (result.version !== null) return { version: result.version, resolvedRepo: repo, error: null }
          if (result.error) errors.push(`[${repo}] ${result.error}`)
        }
        if (!errors.length) {
          return { version: null, error: `No fallback repository produced metadata for ${group}:${artifact}` }
        }
        return { version: null, error: errors.join(' | ') }
      }

      default:
        return { version: null }
    }
  })
}

/**
 * Packages that are internal Minecraft/loader infrastructure and should never
 * appear in the dependency dashboard (mappings, decompilers, internal SPIs…).
 */
const BLOCKED_PACKAGES = new Set([
  'net.fabricmc:intermediary',         // Fabric mappings
  'net.minecraftforge:forgespi',       // Forge internal service API
  'net.minecraftforge:forgeflower',    // ForgeFlower decompiler
  'net.neoforged:neoforgespi',         // NeoForge internal service API
  'de.oceanlabs.mcp:mcp_config',       // MCP mapping data
])

// ---------------------------------------------------------------------------
// Main orchestration
// ---------------------------------------------------------------------------

/** Internal setup result — everything needed before version resolution. */
interface RepoSetup {
  resultKey: string
  ctx: ProjectContext
  deps: VersionCheckResult[]
  fallbackRepos: string[]
}

/**
 * Fetches SBOM + build files, infers context, builds the flat list of deps
 * (with latestVersion = null). Returns null when the SBOM is unavailable.
 */
async function setupRepo(
  owner: string,
  repo: string,
  env: Env,
): Promise<RepoSetup | null> {
  const token = env.GITHUB_TOKEN

  // 1. Fetch SBOM
  const sbom = await fetchSbom(owner, repo, token)
  if (!sbom) return null

  // 2. Fetch build files in parallel
  const [buildContent, gradlePropsContent, settingsContent, versionCatalogContent] = await Promise.all([
    fetchFileContent(owner, repo, 'build.gradle.kts', token).catch(() => null),
    fetchFileContent(owner, repo, 'gradle.properties', token).catch(() => null),
    fetchFileContent(owner, repo, 'settings.gradle.kts', token).catch(() => null),
    fetchFileContent(owner, repo, 'gradle/libs.versions.toml', token).catch(() => null),
  ])

  const repoMap = new Map<string, string>()
  for (const content of [settingsContent, buildContent]) {
    if (!content) continue
    for (const [group, repoUrl] of buildRepoMapping(content).entries()) {
      repoMap.set(group, repoUrl)
    }
  }

  // 3. Build project context
  const { loaders, loaderVersions } = inferLoaders(sbom.packages)
  const ctx: ProjectContext = {
    mcVersion: parseMcVersion(gradlePropsContent, buildContent),
    loaders,
    loaderVersions,
  }

  // 4. Load manual overrides from KV
  const overrides = await getOverrides(env.VERSION_CACHE, owner, repo)

  // 5. Parse declared deps + groups
  const declaredMap = new Map<string, DeclaredDep>()
  const declaredGroups = new Set<string>()

  const ktsFiles: Array<[string | null, string]> = [
    [buildContent,   'build.gradle.kts'],
    [settingsContent, 'settings.gradle.kts'],
  ]
  for (const [content, file] of ktsFiles) {
    if (content) {
      for (const dep of parseDeclaredDeps(content, file)) {
        if (!declaredMap.has(dep.name)) declaredMap.set(dep.name, dep)
      }
      for (const dep of parseDependencyBlocks(content, file)) {
        if (!declaredMap.has(dep.name)) declaredMap.set(dep.name, dep)
      }
      for (const g of parseDeclaredGroups(content)) {
        declaredGroups.add(g)
      }
    }
  }
  if (versionCatalogContent) {
    for (const dep of parseVersionCatalog(versionCatalogContent, 'gradle/libs.versions.toml')) {
      if (!declaredMap.has(dep.name)) declaredMap.set(dep.name, dep)
    }
  }

  // Collect fallback repos
  const fallbackRepos: string[] = []
  for (const content of [buildContent, settingsContent]) {
    if (content) {
      for (const url of buildFallbackRepos(content)) {
        if (!fallbackRepos.includes(url)) fallbackRepos.push(url)
      }
    }
  }

  function pkgGroup(name: string): string {
    const idx = name.indexOf(':')
    return idx !== -1 ? name.slice(0, idx) : name
  }

  function pkgArtifact(name: string): string {
    const idx = name.indexOf(':')
    return idx !== -1 ? name.slice(idx + 1) : ''
  }

  function deriveLogicalArtifact(artifact: string): string {
    let base = artifact
    const LOADER_SUFFIX_RE = /-(forge|neoforge|fabric|quilt|common|lexforge|klf)$/i
    const MC_VERSION_RE = /-(\d+\.)+\d+$/
    for (let i = 0; i < 4; i++) {
      const prev = base
      base = base.replace(LOADER_SUFFIX_RE, '').replace(MC_VERSION_RE, '')
      if (base === prev) break
    }
    return base || artifact
  }

  const declaredExact = new Set(declaredMap.keys())

  const declaredModrinthIds = new Set(
    [...declaredExact]
      .filter(n => n.startsWith('maven.modrinth:'))
      .map(n => pkgArtifact(n).toLowerCase()),
  )

  function allowDeclaredGroupPackage(name: string): boolean {
    const group = pkgGroup(name)
    if (!declaredGroups.has(group)) return false
    if (group !== 'maven.modrinth') return true

    // For Modrinth, avoid a broad group wildcard that can leak unrelated direct deps.
    if (!declaredModrinthIds.size) return false
    const logicalArtifact = deriveLogicalArtifact(pkgArtifact(name)).toLowerCase()
    return declaredModrinthIds.has(logicalArtifact)
  }

  const isLoaderPkg = (name: string) => LOADER_PATTERNS.some(([re]) => re.test(name))

  const targetPackages = declaredGroups.size > 0 || declaredExact.size > 0
    ? sbom.packages.filter(p =>
        !BLOCKED_PACKAGES.has(p.name) && (
          isLoaderPkg(p.name) ||
          declaredExact.has(p.name) ||
          (allowDeclaredGroupPackage(p.name) && sbom.directIds.has(p.SPDXID))
        )
      )
    : sbom.packages.filter(p => !BLOCKED_PACKAGES.has(p.name) && sbom.directIds.has(p.SPDXID))

  const deps: VersionCheckResult[] = targetPackages.map(pkg => {
    const parsed = detectSource(pkg.name, pkg.versionInfo, true, repoMap, overrides)
    let declared = declaredMap.get(pkg.name) ?? declaredMap.get(parsed.logicalName)

    let coordOverride: { identifier: string; mavenRepo: string } | undefined
    if (!declared) {
      const sbomGroup = pkgGroup(pkg.name)
      const candidates: DeclaredDep[] = []
      for (const d of declaredMap.values()) {
        const dGroup = d.name.includes(':') ? d.name.split(':')[0] : d.name
        if (dGroup === sbomGroup || dGroup.startsWith(`${sbomGroup}.`)) candidates.push(d)
      }
      if (candidates.length === 1) {
        declared = candidates[0]
        if (candidates[0].name !== pkg.name) {
          const dGroup = candidates[0].name.split(':')[0]
          const dRepo = resolveRepoUrl(dGroup, repoMap)
          if (dRepo) coordOverride = { identifier: candidates[0].name, mavenRepo: dRepo }
        }
      }
    }

    return {
      ...parsed,
      ...(coordOverride ?? {}),
      declaredIn: declared ? { file: declared.file, line: declared.line } : undefined,
      latestVersion: null,
      upToDate: null,
    }
  })

  return { resultKey: `result:${RESULT_CACHE_VERSION}:${owner}/${repo}`, ctx, deps, fallbackRepos }
}

/**
 * Fetches the GitHub SBOM for a repository, resolves all dependency versions,
 * and returns the complete CheckResult (cached for 5 minutes).
 *
 * Returns null when the SBOM is unavailable.
 */
export async function checkRepo(
  owner: string,
  repo: string,
  env: Env,
): Promise<CheckResult | null> {
  // Fast-path: full result from cache
  const resultKey = `result:${RESULT_CACHE_VERSION}:${owner}/${repo}`
  const cachedResult = await env.VERSION_CACHE.get<CheckResult>(resultKey, 'json')
  if (cachedResult !== null) return cachedResult

  const setup = await setupRepo(owner, repo, env)
  if (!setup) return null
  const { ctx, deps, fallbackRepos } = setup

  const inFlight = new Map<string, Promise<ResolvedVersionInfo>>()
  function resolveLatestVersionDedup(dep: VersionCheckResult): Promise<ResolvedVersionInfo> {
    const key = `version:${VERSION_CACHE_VERSION}:${dep.source}:${dep.identifier}:${dep.currentVersion}:${dep.mavenRepo ?? ''}:${ctx.mcVersion ?? ''}:${ctx.loaders.join(',')}`
    const existing = inFlight.get(key)
    if (existing) return existing
    const p = resolveLatestVersion(dep, env, ctx, fallbackRepos).finally(() => inFlight.delete(key))
    inFlight.set(key, p)
    return p
  }

  await Promise.all(
    deps.map(async dep => {
      const resolved = await resolveLatestVersionDedup(dep)
      dep.latestVersion = resolved.version
      dep.latestError = resolved.error ?? null
      if (resolved.resolvedRepo) dep.mavenRepo = resolved.resolvedRepo
      dep.upToDate = dep.latestVersion !== null
        ? versionsMatchForDisplay(dep.currentVersion, dep.latestVersion, dep.source)
        : null
    }),
  )

  const result: CheckResult = { context: ctx, groups: groupDeps(deps) }
  env.VERSION_CACHE.put(resultKey, JSON.stringify(result), { expirationTtl: 300 }).catch(() => {})
  return result
}

/**
 * Streams dependency version results as Server-Sent Events.
 *
 * Events emitted:
 *   context   { context: ProjectContext, total: number }
 *   checking  { name: string }  (emitted just before each dep starts resolving)
 *   dep       VersionCheckResult  (one per dep, as each resolves)
 *   done      {}
 *   error     { message: string }
 *
 * When the full result is already cached, all events are emitted immediately.
 */
export function checkRepoStream(
  owner: string,
  repo: string,
  env: Env,
): ReadableStream<Uint8Array> {
  const enc = new TextEncoder()

  function emit(ctrl: ReadableStreamDefaultController<Uint8Array>, event: string, data: unknown) {
    ctrl.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
  }

  return new ReadableStream({
    async start(controller) {
      try {
        // Fast-path: stream from cache
        const resultKey = `result:${RESULT_CACHE_VERSION}:${owner}/${repo}`
        const cached = await env.VERSION_CACHE.get<CheckResult>(resultKey, 'json')
        if (cached !== null) {
          const allDeps = cached.groups.flatMap(g => g.variants)
          emit(controller, 'context', { context: cached.context, total: allDeps.length })
          for (const dep of allDeps) emit(controller, 'dep', dep)
          emit(controller, 'done', {})
          controller.close()
          return
        }

        // Setup: fetch SBOM + build files + build dep list
        const setup = await setupRepo(owner, repo, env)
        if (!setup) {
          emit(controller, 'error', { message: 'SBOM not available for this repository' })
          controller.close()
          return
        }

        const { ctx, deps, fallbackRepos } = setup
        emit(controller, 'context', { context: ctx, total: deps.length })

        const inFlight = new Map<string, Promise<ResolvedVersionInfo>>()
        function resolveLatestVersionDedup(dep: VersionCheckResult): { promise: Promise<ResolvedVersionInfo>; isNew: boolean } {
          const key = `version:${VERSION_CACHE_VERSION}:${dep.source}:${dep.identifier}:${dep.currentVersion}:${dep.mavenRepo ?? ''}:${ctx.mcVersion ?? ''}:${ctx.loaders.join(',')}`
          const existing = inFlight.get(key)
          if (existing) return { promise: existing, isNew: false }
          const p = resolveLatestVersion(dep, env, ctx, fallbackRepos).finally(() => inFlight.delete(key))
          inFlight.set(key, p)
          return { promise: p, isNew: true }
        }

        // Resolve each dep concurrently; emit as each one finishes
        await Promise.all(
          deps.map(async dep => {
            emit(controller, 'checking', { name: dep.name })
            const t0 = Date.now()
            const { promise, isNew } = resolveLatestVersionDedup(dep)
            const resolved = await promise
            dep.latestVersion = resolved.version
            dep.latestError = resolved.error ?? null
            if (resolved.resolvedRepo) dep.mavenRepo = resolved.resolvedRepo
            dep.upToDate = dep.latestVersion !== null
              ? versionsMatchForDisplay(dep.currentVersion, dep.latestVersion, dep.source)
              : null
            if (isNew) {
              const elapsed = Date.now() - t0
              const site = dep.mavenRepo ?? dep.source
              console.log(`[version] ${dep.name} (${site}) → ${dep.latestVersion ?? 'null'} [${elapsed}ms]`)
            }
            emit(controller, 'dep', dep)
          }),
        )

        emit(controller, 'done', {})

        // Cache full result
        const result: CheckResult = { context: ctx, groups: groupDeps(deps) }
        env.VERSION_CACHE.put(resultKey, JSON.stringify(result), { expirationTtl: 300 }).catch(() => {})

        controller.close()
      } catch (err) {
        try {
          emit(controller, 'error', { message: String(err) })
          controller.close()
        } catch { /* controller already closed */ }
      }
    },
  })
}
