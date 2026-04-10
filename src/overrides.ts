import type { OverrideMap } from './types.ts'

// KV key pattern: `overrides:{owner}/{repo}`
function overrideKey(owner: string, repo: string): string {
  return `overrides:${owner}/${repo}`
}

/**
 * Returns the override map for the given repository.
 * Returns an empty object when no overrides have been set.
 */
export async function getOverrides(
  kv: KVNamespace,
  owner: string,
  repo: string,
): Promise<OverrideMap> {
  const raw = await kv.get(overrideKey(owner, repo))
  if (!raw) return {}
  try {
    return JSON.parse(raw) as OverrideMap
  } catch {
    return {}
  }
}

/**
 * Persists the override map for the given repository.
 * Passing an empty object clears all overrides.
 */
export async function setOverrides(
  kv: KVNamespace,
  owner: string,
  repo: string,
  map: OverrideMap,
): Promise<void> {
  if (Object.keys(map).length === 0) {
    await kv.delete(overrideKey(owner, repo))
  } else {
    await kv.put(overrideKey(owner, repo), JSON.stringify(map))
  }
}
