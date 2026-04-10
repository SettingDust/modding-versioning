// ---------------------------------------------------------------------------
// Utility: balanced brace extraction
// ---------------------------------------------------------------------------

/**
 * Given a string that starts at (or before) a `{`, returns the content between
 * the first `{` and its matching `}`.  Returns null if no balanced block is found.
 *
 * Note: this does not handle brace characters inside Kotlin string literals; in
 * practice this is safe for the Gradle KTS patterns we target.
 */
function extractBalancedBlock(content: string): string | null {
  let i = 0
  // Skip whitespace / characters until we hit the opening brace.
  while (i < content.length && content[i] !== '{') {
    i++
    if (i > 200) return null // No opening brace found nearby
  }
  if (i >= content.length) return null

  const blockStart = i
  let depth = 0
  while (i < content.length) {
    if (content[i] === '{') depth++
    else if (content[i] === '}') {
      depth--
      if (depth === 0) return content.slice(blockStart + 1, i)
    }
    i++
  }
  return null
}

// ---------------------------------------------------------------------------
// Repository → URL mapping (from build.gradle.kts repositories {} block)
// ---------------------------------------------------------------------------

/**
 * Finds the outermost `repositories {` block in the given content and returns
 * a Map from Maven group prefix → repository base URL.
 *
 * Handles:
 *   maven("url") { content { includeGroup("group") } }
 *   maven("url") { content { includeGroupAndSubgroups("group") } }
 *   exclusiveContent { forRepository { maven("url") } filter { includeGroup("group") } }
 *   mavenCentral()  →  https://repo1.maven.org/maven2
 */
export function buildRepoMapping(content: string): Map<string, string> {
  const groupToRepo = new Map<string, string>()

  // Find the top-level repositories { } block.
  const repoBlockMatch = content.match(/\brepositories\s*\{/)
  if (!repoBlockMatch) return groupToRepo

  const afterKeyword = content.slice(repoBlockMatch.index! + repoBlockMatch[0].length - 1)
  const repoBlock = extractBalancedBlock(afterKeyword)
  if (!repoBlock) return groupToRepo

  if (repoBlock.includes('mavenCentral()')) {
    groupToRepo.set('__central__', 'https://repo1.maven.org/maven2')
  }

  // For each maven("url") occurrence, look at the text up to the next maven(" for groups.
  const mavenUrlRe = /\bmaven\s*\(\s*["']([^"']+)["']\s*\)/g
  let m: RegExpExecArray | null

  while ((m = mavenUrlRe.exec(repoBlock)) !== null) {
    const repoUrl = m[1].replace(/\/$/, '')
    const searchStart = m.index + m[0].length

    // Bound the search at the next maven(" to avoid cross-contamination.
    const rest = repoBlock.slice(searchStart)
    const nextMavenIdx = rest.search(/\bmaven\s*\(\s*["']/)
    const searchArea = nextMavenIdx === -1 ? rest : rest.slice(0, nextMavenIdx)

    const exactGroup = searchArea.match(/\bincludeGroup\s*\(\s*["']([^"']+)["']\s*\)/)
    const subGroups = searchArea.match(/\bincludeGroupAndSubgroups\s*\(\s*["']([^"']+)["']\s*\)/)

    if (exactGroup) groupToRepo.set(exactGroup[1], repoUrl)
    if (subGroups) groupToRepo.set(subGroups[1], repoUrl)
  }

  return groupToRepo
}

/**
 * Returns the best known repository URL for a given Maven group.
 * Falls back to Maven Central if no specific mapping is found.
 */
export function resolveRepoUrl(group: string, groupToRepo: Map<string, string>): string | undefined {
  // Exact match first
  if (groupToRepo.has(group)) return groupToRepo.get(group)

  // Prefix match (covers includeGroupAndSubgroups semantics)
  for (const [prefix, url] of groupToRepo.entries()) {
    if (prefix.startsWith('__')) continue
    if (group === prefix || group.startsWith(`${prefix}.`)) return url
  }

  // Fallback to Maven Central
  return groupToRepo.get('__central__')
}

// ---------------------------------------------------------------------------
// Minecraft version extraction
// ---------------------------------------------------------------------------

/**
 * Tries to extract the Minecraft version from Gradle project files.
 *
 * Search order (first match wins):
 * 1. gradle.properties  — `minecraft_version = 1.21.1`
 *                         `mc_version = 1.21.1`
 *                         `minecraftVersion = 1.21.1`
 * 2. build.gradle.kts   — `val mcVersion = "1.21.1"`
 *                         `val minecraftVersion = "1.21.1"`
 */
export function parseMcVersion(
  gradlePropsContent: string | null,
  buildContent: string | null,
): string | null {
  // 1. gradle.properties (key = value, optional spaces)
  if (gradlePropsContent) {
    const m = gradlePropsContent.match(
      /^(?:minecraft_version|mc_version|minecraftVersion)\s*=\s*([\d.]+[\w.-]*)/im,
    )
    if (m) return m[1].trim()
  }

  // 2. build.gradle.kts
  if (buildContent) {
    const m = buildContent.match(
      /\bval\s+(?:mcVersion|minecraftVersion)\s*=\s*["']([\d.]+[\w.-]*)["']/,
    )
    if (m) return m[1].trim()
  }

  return null
}

// ---------------------------------------------------------------------------
// Declared dependency extraction from Gradle KTS build/settings files
// ---------------------------------------------------------------------------

import type { DeclaredDep } from './types.ts'

/**
 * Extracts explicitly declared Maven dependency coordinates (group:artifact)
 * from a Gradle KTS build file or settings file, with file + line tracking.
 *
 * Matches:
 *   1. String literals containing Maven GAV coordinates:
 *        implementation("maven.modrinth:sodium:mc1.21.1-0.6.0+build.24")
 *   2. Three-argument library() calls (Gradle version catalog builder API):
 *        library("name", "group", "artifact").version("...")
 *        library("name", "group.id", "artifact-id")
 */
export function parseDeclaredDeps(content: string, file: string): DeclaredDep[] {
  const result: DeclaredDep[] = []
  const seen = new Set<string>()
  const lines = content.split('\n')

  // Pattern 1: "group:artifact[:version]" string literals
  const gavRe = /["']([a-zA-Z][a-zA-Z0-9._-]*:[a-zA-Z][a-zA-Z0-9._-]*)(?::[^"'\s]*)?["']/g
  // Pattern 2: library("catalogName", "group", "artifact")
  const libRe = /\blibrary\s*\(\s*"[^"]*"\s*,\s*"([a-zA-Z][a-zA-Z0-9._-]*)"\s*,\s*"([a-zA-Z][a-zA-Z0-9._-]*)"\s*\)/g

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lineNum = i + 1

    gavRe.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = gavRe.exec(line)) !== null) {
      const name = m[1]
      if (!seen.has(name)) { seen.add(name); result.push({ name, file, line: lineNum }) }
    }

    libRe.lastIndex = 0
    while ((m = libRe.exec(line)) !== null) {
      const name = `${m[1]}:${m[2]}`
      if (!seen.has(name)) { seen.add(name); result.push({ name, file, line: lineNum }) }
    }
  }
  return result
}

/**
 * Extracts explicitly declared Maven dependency coordinates from a Gradle
 * version catalog file (`gradle/libs.versions.toml`).
 *
 * Handles two TOML declaration styles:
 *   module = "group:artifact"                            (single attribute)
 *   { group = "mezz.jei", name = "jei-1.21-fabric" }   (split attributes, same or adjacent lines)
 */
export function parseVersionCatalog(content: string, file: string): DeclaredDep[] {
  const result: DeclaredDep[] = []
  const seen = new Set<string>()
  const lines = content.split('\n')

  let pendingGroup: string | null = null
  let pendingLine = 0

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]
    const line = raw.trim()
    const lineNum = i + 1

    // Pattern 1: module = "group:artifact[:version]" anywhere on the line
    const moduleRe = /\bmodule\s*=\s*["']([a-zA-Z][a-zA-Z0-9._-]*:[a-zA-Z][a-zA-Z0-9._-]*)(?::[^"']*)?["']/g
    let m: RegExpExecArray | null
    while ((m = moduleRe.exec(raw)) !== null) {
      const name = m[1]
      if (!seen.has(name)) {
        seen.add(name)
        result.push({ name, file, line: lineNum })
      }
    }

    // Pattern 2: group and name on same line (inline table or comma-separated)
    const groupOnLine = raw.match(/\bgroup\s*=\s*["']([^"']+)["']/)
    const nameOnLine  = raw.match(/\bname\s*=\s*["']([^"']+)["']/)
    if (groupOnLine && nameOnLine) {
      const depName = `${groupOnLine[1]}:${nameOnLine[1]}`
      if (!seen.has(depName)) {
        seen.add(depName)
        result.push({ name: depName, file, line: lineNum })
      }
      pendingGroup = null
      continue
    }

    // Pattern 2b: group on one line, name on the next
    if (groupOnLine && !nameOnLine) {
      pendingGroup = groupOnLine[1]
      pendingLine  = lineNum
      continue
    }
    if (nameOnLine && pendingGroup) {
      const depName = `${pendingGroup}:${nameOnLine[1]}`
      if (!seen.has(depName)) {
        seen.add(depName)
        result.push({ name: depName, file, line: pendingLine })
      }
      pendingGroup = null
      continue
    }

    // Reset pending group on TOML section headers or blank lines
    if (line.startsWith('[') || line === '') {
      pendingGroup = null
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Declared group extraction from Gradle KTS version catalog DSL
// ---------------------------------------------------------------------------

/**
 * Extracts the set of Maven group IDs that are explicitly declared in a
 * Gradle KTS settings/build file.  This is used to filter SBOM packages —
 * only packages whose group was deliberately declared should be shown.
 *
 * Handles:
 *   library("catalogName", "GROUP", "artifact")  → GROUP
 *   dependency("id", "GROUP") { … }              → GROUP
 *   modrinth("id") { … }                         → "maven.modrinth"
 *
 * The `modrinth()` helper is syntactic sugar for
 * `dependency(id, "maven.modrinth", block)` so we capture it explicitly.
 */
export function parseDeclaredGroups(content: string): Set<string> {
  const groups = new Set<string>()

  // library("name", "GROUP", "artifact") — intentionally NOT added here.
  // The 3-arg library() form declares a specific group:artifact coordinate which is
  // already captured as an exact entry by parseDeclaredDeps/parseVersionCatalog.
  // Adding the whole GROUP to declaredGroups would open a wildcard that pulls in any
  // direct SBOM package from that group, e.g. net.fabricmc:intermediary leaking in
  // alongside net.fabricmc:sponge-mixin even though only the latter was declared.

  // dependency("id", "GROUP") { … } — only add GROUP when the block uses artifact() formatters.
  // Blocks with only a static `artifact = "…"` declaration are handled by exact matching
  // (parseDependencyBlocks), so adding the group here would cause sub-module expansion.
  const depCallRe2 = /\bdependency\s*\(\s*"[^"]*"\s*,\s*"([a-zA-Z][a-zA-Z0-9._-]*)"\s*\)/g
  let m: RegExpExecArray | null
  while ((m = depCallRe2.exec(content)) !== null) {
    const group = m[1]
    const rest = content.slice(m.index + m[0].length)
    const blockContent = extractBalancedBlock(rest)
    if (blockContent && /\bartifact\s*\(/.test(blockContent)) groups.add(group)
  }

  // modrinth("id") { … }  → always maps to "maven.modrinth"
  if (/\bmodrinth\s*\(/.test(content)) groups.add('maven.modrinth')

  return groups
}

/**
 * Extracts Maven dependency coordinates from multi-line `dependency()` blocks
 * in Gradle KTS settings files, with file + line tracking.
 *
 * Handles:
 *   dependency("id", "GROUP") {
 *     artifact = "ARTIFACT"
 *     …
 *   }
 *
 * When an explicit `artifact = "…"` assignment is present the exact coordinate
 * "GROUP:ARTIFACT" is returned.  Blocks without a static artifact assignment
 * are skipped (their group is already captured by parseDeclaredGroups).
 */
export function parseDependencyBlocks(content: string, file: string): DeclaredDep[] {
  const result: DeclaredDep[] = []
  const seen = new Set<string>()

  // Match dependency("id", "group") — the opening paren must close before the block {
  const depCallRe = /\bdependency\s*\(\s*"[^"]*"\s*,\s*"([a-zA-Z][a-zA-Z0-9._-]*)"\s*\)/g
  let m: RegExpExecArray | null

  while ((m = depCallRe.exec(content)) !== null) {
    const group = m[1]
    const lineNum = content.slice(0, m.index).split('\n').length

    // Extract the { } block that immediately follows this call
    const rest = content.slice(m.index + m[0].length)
    const blockContent = extractBalancedBlock(rest)
    if (!blockContent) continue

    // Look for a static artifact assignment: artifact = "VALUE"
    const artifactMatch = blockContent.match(/\bartifact\s*=\s*"([^"]+)"/)
    if (!artifactMatch) continue

    const name = `${group}:${artifactMatch[1]}`
    if (!seen.has(name)) {
      seen.add(name)
      result.push({ name, file, line: lineNum })
    }
  }

  // Match modrinth("id") calls → provide file+line for the `declaredIn` annotation.
  // modrinth() is syntactic sugar for dependency(id, "maven.modrinth", block), so the
  // logical identifier that appears in the SBOM is "maven.modrinth:{id}".
  const modrinthRe = /\bmodrinth\s*\(\s*"([^"]+)"\s*\)/g
  while ((m = modrinthRe.exec(content)) !== null) {
    const name = `maven.modrinth:${m[1]}`
    const lineNum = content.slice(0, m.index).split('\n').length
    if (!seen.has(name)) {
      seen.add(name)
      result.push({ name, file, line: lineNum })
    }
  }

  return result
}

/**
 * Returns all Maven repository URLs declared in the `repositories {}` block of
 * a Gradle KTS file that have NO explicit `includeGroup` / `includeGroupAndSubgroups`
 * filter.  These are open repositories that can serve any artifact and are
 * suitable as fallback candidates when we cannot determine a package's specific
 * repository from group mappings alone.
 */
export function buildFallbackRepos(content: string): string[] {
  const repos: string[] = []

  const repoBlockMatch = content.match(/\brepositories\s*\{/)
  if (!repoBlockMatch) return repos

  const afterKeyword = content.slice(repoBlockMatch.index! + repoBlockMatch[0].length - 1)
  const repoBlock = extractBalancedBlock(afterKeyword)
  if (!repoBlock) return repos

  const mavenUrlRe = /\bmaven\s*\(\s*["']([^"']+)["']\s*\)/g
  let m: RegExpExecArray | null

  while ((m = mavenUrlRe.exec(repoBlock)) !== null) {
    const repoUrl = m[1].replace(/\/$/, '')
    const searchStart = m.index + m[0].length
    const rest = repoBlock.slice(searchStart)
    const nextMavenIdx = rest.search(/\bmaven\s*\(\s*["']/)
    const searchArea = nextMavenIdx === -1 ? rest : rest.slice(0, nextMavenIdx)
    const hasFilter = /\bincludeGroup(?:AndSubgroups)?\s*\(/.test(searchArea)
    if (!hasFilter) repos.push(repoUrl)
  }

  return repos
}
