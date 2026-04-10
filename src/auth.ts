import type { Context } from 'hono'
import type { Env } from './types.ts'

/**
 * Constant-time string comparison to prevent timing-based token enumeration.
 */
function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder()
  const aBytes = encoder.encode(a)
  const bBytes = encoder.encode(b)

  // Length check is intentionally not constant-time, but token length is not secret.
  if (aBytes.length !== bBytes.length) return false

  let result = 0
  for (let i = 0; i < aBytes.length; i++) {
    result |= aBytes[i] ^ bBytes[i]
  }
  return result === 0
}

/**
 * Extracts the Bearer token from the request (Authorization header or ?token= query param).
 * Returns null if no token is present.
 */
function extractToken(c: Context<{ Bindings: Env }>): string | null {
  const authHeader = c.req.header('Authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7).trim()

  const queryToken = c.req.query('token')
  if (queryToken) return queryToken.trim()

  return null
}

/**
 * Returns true if the request carries a valid ACCESS_TOKEN.
 * If ACCESS_TOKEN is not configured, all requests are considered authorised.
 */
export function verifyToken(c: Context<{ Bindings: Env }>): boolean {
  const configuredToken = c.env.ACCESS_TOKEN
  if (!configuredToken) return true

  const provided = extractToken(c)
  if (!provided) return false

  return timingSafeEqual(provided, configuredToken)
}


