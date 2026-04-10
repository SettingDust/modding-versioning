import type { RepoEntry } from './types.ts'

const KV_KEY = 'repos:list'

export async function listRepos(kv: KVNamespace): Promise<RepoEntry[]> {
  const data = await kv.get<RepoEntry[]>(KV_KEY, 'json')
  return data ?? []
}

export async function addRepo(
  kv: KVNamespace,
  owner: string,
  repo: string,
): Promise<RepoEntry[]> {
  const repos = await listRepos(kv)
  const key = `${owner.toLowerCase()}/${repo.toLowerCase()}`

  if (repos.some((r) => `${r.owner.toLowerCase()}/${r.repo.toLowerCase()}` === key)) {
    return repos
  }

  const updated: RepoEntry[] = [...repos, { owner, repo, addedAt: new Date().toISOString() }]
  await kv.put(KV_KEY, JSON.stringify(updated))
  return updated
}

export async function removeRepo(
  kv: KVNamespace,
  owner: string,
  repo: string,
): Promise<RepoEntry[]> {
  const repos = await listRepos(kv)
  const key = `${owner.toLowerCase()}/${repo.toLowerCase()}`
  const updated = repos.filter(
    (r) => `${r.owner.toLowerCase()}/${r.repo.toLowerCase()}` !== key,
  )
  await kv.put(KV_KEY, JSON.stringify(updated))
  return updated
}
