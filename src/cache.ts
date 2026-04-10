/**
 * KV-backed cache wrapper.
 *
 * On a cache miss the fetcher is called, its result is stored in KV with the
 * specified TTL (seconds), and the result is returned.
 */
export async function cachedFetch<T>(
  kv: KVNamespace,
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await kv.get<T>(key, 'json')
  if (cached !== null) return cached

  const result = await fetcher()
  // Fire-and-forget; we don't want a KV write failure to break the response.
  kv.put(key, JSON.stringify(result), { expirationTtl: ttlSeconds }).catch(() => {})
  return result
}
