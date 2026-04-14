import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env, ProjectContext } from './types.ts'
import type { OverrideMap } from './types.ts'
import { verifyToken } from './auth.ts'
import { listRepos, addRepo, removeRepo } from './repos.ts'
import { getOverrides, setOverrides } from './overrides.ts'
import { checkRepo, checkRepoStream } from './checker.ts'
import { getLatestFabricLoader } from './sources/fabric.ts'
import { getLatestMavenVersion } from './sources/maven.ts'
import { getLatestModrinthVersion } from './sources/modrinth.ts'
import { getLatestCurseForgeVersion } from './sources/curseforge.ts'
import { renderDashboard } from './dashboard.tsx'

const app = new Hono<{ Bindings: Env }>()

// Allow cross-origin reads (so the dashboard can be hosted separately if desired)
app.use('/api/*', cors({ origin: '*', allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] }))

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
app.get('/', c => c.html(renderDashboard()))

// ---------------------------------------------------------------------------
// Repo list
// ---------------------------------------------------------------------------

app.get('/api/repos', async c => {
  const repos = await listRepos(c.env.VERSION_CACHE)
  return c.json(repos)
})

app.post('/api/repos', async c => {
  if (!verifyToken(c)) return c.text('Unauthorized', 401)

  let body: { owner?: string; repo?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.text('Invalid JSON', 400)
  }

  const { owner, repo } = body
  if (
    typeof owner !== 'string' || !owner.trim() ||
    typeof repo !== 'string' || !repo.trim()
  ) {
    return c.text('owner and repo are required', 400)
  }

  // Validate owner/repo to safe characters (alphanumeric, hyphens, dots, underscores)
  if (!/^[a-zA-Z0-9._-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) {
    return c.text('Invalid owner or repo name', 400)
  }

  const updated = await addRepo(c.env.VERSION_CACHE, owner, repo)
  return c.json(updated, 201)
})

app.delete('/api/repos/:owner/:repo', async c => {
  if (!verifyToken(c)) return c.text('Unauthorized', 401)

  const owner = c.req.param('owner')
  const repo = c.req.param('repo')

  // Validate owner/repo param before using them as KV keys
  if (!/^[a-zA-Z0-9._-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) {
    return c.text('Invalid owner or repo name', 400)
  }

  const updated = await removeRepo(c.env.VERSION_CACHE, owner, repo)
  return c.json(updated)
})

// ---------------------------------------------------------------------------
// Version check (main endpoint)
// ---------------------------------------------------------------------------

app.get('/api/check', async c => {
  const requiresAuth = c.env.PARSE_REQUIRES_AUTH?.toLowerCase() === 'true'
  if (requiresAuth && !verifyToken(c)) return c.text('Unauthorized', 401)

  const owner = c.req.query('owner')?.trim()
  const repo  = c.req.query('repo')?.trim()

  if (!owner || !repo) return c.text('owner and repo query params are required', 400)

  // Validate before using as URL path segments
  if (!/^[a-zA-Z0-9._-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) {
    return c.text('Invalid owner or repo name', 400)
  }

  try {
    const results = await checkRepo(owner, repo, c.env)
    if (!results) return c.text('SBOM not available for this repository', 404)
    return c.json(results)
  } catch (err) {
    console.error('checkRepo error:', err)
    return c.text('Internal server error', 500)
  }
})

// ---------------------------------------------------------------------------
// Streaming version check (SSE)
// ---------------------------------------------------------------------------

app.get('/api/stream', c => {
  const requiresAuth = c.env.PARSE_REQUIRES_AUTH?.toLowerCase() === 'true'
  if (requiresAuth && !verifyToken(c)) return c.text('Unauthorized', 401)

  const owner = c.req.query('owner')?.trim()
  const repo  = c.req.query('repo')?.trim()

  if (!owner || !repo) return c.text('owner and repo query params are required', 400)

  if (!/^[a-zA-Z0-9._-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) {
    return c.text('Invalid owner or repo name', 400)
  }

  const stream = checkRepoStream(owner, repo, c.env)
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  })
})

// ---------------------------------------------------------------------------
// Overrides
// ---------------------------------------------------------------------------

app.get('/api/overrides', async c => {
  const owner = c.req.query('owner')?.trim()
  const repo  = c.req.query('repo')?.trim()
  if (!owner || !repo) return c.text('owner and repo are required', 400)

  if (!/^[a-zA-Z0-9._-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) {
    return c.text('Invalid owner or repo name', 400)
  }

  const overrides = await getOverrides(c.env.VERSION_CACHE, owner, repo)
  return c.json(overrides)
})

app.put('/api/overrides', async c => {
  if (!verifyToken(c)) return c.text('Unauthorized', 401)

  const owner = c.req.query('owner')?.trim()
  const repo  = c.req.query('repo')?.trim()
  if (!owner || !repo) return c.text('owner and repo are required', 400)

  if (!/^[a-zA-Z0-9._-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) {
    return c.text('Invalid owner or repo name', 400)
  }

  let body: OverrideMap
  try {
    body = await c.req.json() as OverrideMap
  } catch {
    return c.text('Invalid JSON', 400)
  }

  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return c.text('Body must be a JSON object', 400)
  }

  await setOverrides(c.env.VERSION_CACHE, owner, repo, body)
  return c.json({ ok: true })
})

app.patch('/api/overrides', async c => {
  if (!verifyToken(c)) return c.text('Unauthorized', 401)

  const owner = c.req.query('owner')?.trim()
  const repo  = c.req.query('repo')?.trim()
  if (!owner || !repo) return c.text('owner and repo are required', 400)

  if (!/^[a-zA-Z0-9._-]+$/.test(owner) || !/^[a-zA-Z0-9._-]+$/.test(repo)) {
    return c.text('Invalid owner or repo name', 400)
  }

  let body: { dep: string; mavenRepo: string }
  try {
    body = await c.req.json()
  } catch {
    return c.text('Invalid JSON', 400)
  }

  const { dep, mavenRepo } = body ?? {}
  if (typeof dep !== 'string' || !dep.trim()) return c.text('dep is required', 400)
  if (typeof mavenRepo !== 'string' || !mavenRepo.trim()) return c.text('mavenRepo is required', 400)

  // Validate mavenRepo is a well-formed HTTP/HTTPS URL
  try {
    const url = new URL(mavenRepo.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error()
  } catch {
    return c.text('mavenRepo must be a valid HTTP/HTTPS URL', 400)
  }

  const existing = await getOverrides(c.env.VERSION_CACHE, owner, repo)
  existing[dep.trim()] = { source: 'maven', mavenRepo: mavenRepo.trim() }
  await setOverrides(c.env.VERSION_CACHE, owner, repo, existing)

  // Invalidate full-result cache so next check picks up the new override
  await c.env.VERSION_CACHE.delete(`result:${owner}/${repo}`)

  return c.json({ ok: true })
})

// ---------------------------------------------------------------------------
// Individual version endpoints (useful for badges / external tooling)
// ---------------------------------------------------------------------------

app.get('/api/versions/fabric', async c => {
  try {
    const version = await getLatestFabricLoader()
    return c.json({ version })
  } catch {
    return c.text('Failed to fetch Fabric version', 502)
  }
})

app.get('/api/versions/modrinth/:slug', async c => {
  const slug = c.req.param('slug')
  if (!/^[a-zA-Z0-9._-]+$/.test(slug)) return c.text('Invalid slug', 400)

  const mcVersion = c.req.query('mc_version')?.trim() || null
  const loadersRaw = c.req.query('loaders')?.trim()
  const ctx: ProjectContext | undefined = (mcVersion || loadersRaw)
    ? { mcVersion, loaders: loadersRaw ? loadersRaw.split(',').map(l => l.trim()).filter(Boolean) : [], loaderVersions: {} }
    : undefined

  try {
    const version = await getLatestModrinthVersion(slug, ctx)
    return c.json({ version })
  } catch {
    return c.text('Failed to fetch Modrinth version', 502)
  }
})

app.get('/api/versions/curseforge/:id', async c => {
  const id = c.req.param('id')
  if (!/^\d+$/.test(id)) return c.text('id must be numeric', 400)
  if (!c.env.CURSEFORGE_API_KEY) return c.text('CurseForge API key not configured', 503)

  const mcVersion = c.req.query('mc_version')?.trim() || null
  const loadersRaw = c.req.query('loaders')?.trim()
  const ctx: ProjectContext | undefined = (mcVersion || loadersRaw)
    ? { mcVersion, loaders: loadersRaw ? loadersRaw.split(',').map(l => l.trim()).filter(Boolean) : [], loaderVersions: {} }
    : undefined

  try {
    const version = await getLatestCurseForgeVersion(id, c.env.CURSEFORGE_API_KEY, ctx)
    return c.json({ version })
  } catch {
    return c.text('Failed to fetch CurseForge version', 502)
  }
})

app.get('/api/versions/maven', async c => {
  const repoUrl  = c.req.query('repo')?.trim()
  const group    = c.req.query('group')?.trim()
  const artifact = c.req.query('artifact')?.trim()

  if (!repoUrl || !group || !artifact) {
    return c.text('repo, group and artifact query params are required', 400)
  }

  // Basic URL validation — must be an https URL
  let parsedUrl: URL
  try {
    parsedUrl = new URL(repoUrl)
  } catch {
    return c.text('Invalid repo URL', 400)
  }
  if (parsedUrl.protocol !== 'https:') return c.text('repo URL must use https', 400)

  try {
    const version = await getLatestMavenVersion(repoUrl, group, artifact)
    return c.json({ version })
  } catch {
    return c.text('Failed to fetch Maven version', 502)
  }
})

export default app
