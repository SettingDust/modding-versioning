import { beforeEach, describe, expect, it, vi } from 'vitest'

const checkRepoMock = vi.hoisted(() => vi.fn())
const checkRepoStreamMock = vi.hoisted(() => vi.fn())

vi.mock('../checker.ts', () => ({
  checkRepo: checkRepoMock,
  checkRepoStream: checkRepoStreamMock,
}))

import app from '../index.tsx'

function createTestKv(): KVNamespace {
  const store = new Map<string, string>()
  return {
    async get(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream') {
      const value = store.get(key)
      if (value === undefined) return null
      if (type === 'json') return JSON.parse(value)
      return value
    },
    async put(key: string, value: string) {
      store.set(key, value)
    },
    async delete(key: string) {
      store.delete(key)
    },
  } as unknown as KVNamespace
}

function createTestEnv() {
  return {
    VERSION_CACHE: createTestKv(),
  } as const
}

describe('API route basics after template removal', () => {
  beforeEach(() => {
    checkRepoMock.mockReset()
    checkRepoStreamMock.mockReset()
  })

  it('returns 400 when /api/check is missing owner/repo', async () => {
    const res = await app.request('http://localhost/api/check', undefined, createTestEnv())

    expect(res.status).toBe(400)
    await expect(res.text()).resolves.toContain('owner and repo query params are required')
    expect(checkRepoMock).not.toHaveBeenCalled()
  })

  it('returns 400 when /api/stream is missing owner/repo', async () => {
    const res = await app.request('http://localhost/api/stream', undefined, createTestEnv())

    expect(res.status).toBe(400)
    await expect(res.text()).resolves.toContain('owner and repo query params are required')
    expect(checkRepoStreamMock).not.toHaveBeenCalled()
  })

  it('enters normal /api/check path and delegates to checker', async () => {
    checkRepoMock.mockResolvedValue({ context: { mcVersion: null, loaders: [], loaderVersions: {} }, groups: [] })

    const res = await app.request('http://localhost/api/check?owner=octocat&repo=my-mod', undefined, createTestEnv())

    expect(res.status).toBe(200)
    expect(checkRepoMock).toHaveBeenCalledTimes(1)
    expect(checkRepoMock).toHaveBeenCalledWith(
      'octocat',
      'my-mod',
      expect.any(Object),
    )
  })

  it('returns event-stream and includes context/done events', async () => {
    const sse = [
      'event: context\ndata: {"context":{"mcVersion":"1.21.1","loaders":[],"loaderVersions":{}},"total":0}\n\n',
      'event: done\ndata: {}\n\n',
    ].join('')

    checkRepoStreamMock.mockReturnValue(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse))
        controller.close()
      },
    }))

    const res = await app.request('http://localhost/api/stream?owner=octocat&repo=my-mod', undefined, createTestEnv())

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const body = await res.text()
    expect(body).toContain('event: context')
    expect(body).toContain('event: done')
  })

  it('returns event-stream and can carry error events', async () => {
    const sse = 'event: error\ndata: {"message":"boom"}\n\n'
    checkRepoStreamMock.mockReturnValue(new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(sse))
        controller.close()
      },
    }))

    const res = await app.request('http://localhost/api/stream?owner=octocat&repo=my-mod', undefined, createTestEnv())

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/event-stream')
    const body = await res.text()
    expect(body).toContain('event: error')
  })

  it('accepts repoInput as GitHub URL with .git, query and fragment', async () => {
    const env = createTestEnv()
    const res = await app.request('http://localhost/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoInput: 'https://github.com/Octo-Cat/My.Mod.git?tab=readme#top' }),
    }, env)

    expect(res.status).toBe(201)
    const body = await res.json() as Array<{ owner: string; repo: string }>
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({ owner: 'Octo-Cat', repo: 'My.Mod' })
  })

  it('accepts repoInput as owner/repo plain text', async () => {
    const env = createTestEnv()
    const res = await app.request('http://localhost/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoInput: 'owner123/repo_abc' }),
    }, env)

    expect(res.status).toBe(201)
    const body = await res.json() as Array<{ owner: string; repo: string }>
    expect(body[0]).toMatchObject({ owner: 'owner123', repo: 'repo_abc' })
  })

  it('rejects repoInput with invalid host', async () => {
    const res = await app.request('http://localhost/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoInput: 'https://gitlab.com/owner/repo' }),
    }, createTestEnv())

    expect(res.status).toBe(400)
    await expect(res.text()).resolves.toBe('Repository must be a GitHub URL or owner/repo.')
  })

  it('rejects repoInput with extra path segment', async () => {
    const res = await app.request('http://localhost/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoInput: 'https://github.com/owner/repo/issues' }),
    }, createTestEnv())

    expect(res.status).toBe(400)
    await expect(res.text()).resolves.toBe('Repository must be a GitHub URL or owner/repo.')
  })

  it('rejects repoInput with missing segment', async () => {
    const res = await app.request('http://localhost/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoInput: 'github.com/owner' }),
    }, createTestEnv())

    expect(res.status).toBe(400)
    await expect(res.text()).resolves.toBe('Repository must be a GitHub URL or owner/repo.')
  })

  it('keeps legacy body compatibility with owner/repo', async () => {
    const env = createTestEnv()
    const res = await app.request('http://localhost/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner: 'legacyOwner', repo: 'legacyRepo' }),
    }, env)

    expect(res.status).toBe(201)
    const body = await res.json() as Array<{ owner: string; repo: string }>
    expect(body[0]).toMatchObject({ owner: 'legacyOwner', repo: 'legacyRepo' })
  })

  it('uses repoInput when repoInput and owner/repo are both provided', async () => {
    const env = createTestEnv()
    const res = await app.request('http://localhost/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        repoInput: 'github.com/newOwner/newRepo',
        owner: 'oldOwner',
        repo: 'oldRepo',
      }),
    }, env)

    expect(res.status).toBe(201)
    const body = await res.json() as Array<{ owner: string; repo: string }>
    expect(body[0]).toMatchObject({ owner: 'newOwner', repo: 'newRepo' })
  })

  it('falls back to owner/repo when repoInput is empty string', async () => {
    const env = createTestEnv()
    const res = await app.request('http://localhost/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoInput: '', owner: 'fallbackOwner', repo: 'fallbackRepo' }),
    }, env)

    expect(res.status).toBe(201)
    const body = await res.json() as Array<{ owner: string; repo: string }>
    expect(body[0]).toMatchObject({ owner: 'fallbackOwner', repo: 'fallbackRepo' })
  })

  it('falls back to owner/repo when repoInput is whitespace only', async () => {
    const env = createTestEnv()
    const res = await app.request('http://localhost/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoInput: '   ', owner: 'trimOwner', repo: 'trimRepo' }),
    }, env)

    expect(res.status).toBe(201)
    const body = await res.json() as Array<{ owner: string; repo: string }>
    expect(body[0]).toMatchObject({ owner: 'trimOwner', repo: 'trimRepo' })
  })

  it('returns 400 for malformed repoInput URL encoding with English error', async () => {
    const res = await app.request('http://localhost/api/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoInput: 'https://github.com/%E0%A4%A/repo' }),
    }, createTestEnv())

    expect(res.status).toBe(400)
    await expect(res.text()).resolves.toBe('Repository must be a GitHub URL or owner/repo.')
  })
})