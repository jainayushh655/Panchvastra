/**
 * Admin session cookie — the shared contract.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT THIS MODULE IS, AND WHAT IT IS DELIBERATELY NOT
 * ──────────────────────────────────────────────────────────────────────────────
 * The cookie NAME, PATH, ATTRIBUTES and LIFETIME live here, plus the two pure functions
 * that reason about a token's shape. Nothing here grants access, reads a cookie, or talks
 * to the backend. It is the vocabulary three very different runtimes have to agree on:
 *
 *   - `proxy.ts`                 — Edge runtime, no Node APIs.
 *   - `lib/adminSession.server.ts`    — Node, reads `cookies()`, verifies with the backend.
 *   - `app/admin/api/session/route.ts` — Node, sets and clears the cookie.
 *
 * Because the proxy runs on the Edge, this module imports nothing but a type and uses no
 * Node built-in. Keep it that way: a stray `node:` import here breaks the proxy build
 * rather than the file that added it.
 *
 * ⚠️ NOTHING IN THIS FILE IS A SECURITY CHECK. `looksLikeJwt` and `readTokenExpiry` parse
 * a token WITHOUT verifying its signature, exactly like `lib/jwtPayload.ts`, and for the
 * same reason: they decide how long to keep a cookie and whether a request is worth
 * forwarding at all. Authorization is established in ONE place — a real call to a
 * backend admin-only endpoint — see `adminSession.server.ts`.
 */

/**
 * The cookie name. Prefixed like the existing storage keys so the two applications can
 * share a browser profile during migration without colliding.
 */
export const ADMIN_SESSION_COOKIE = 'pv_admin_session'

/**
 * ⚠️ THE PATH IS LOAD-BEARING, AND IT IS WHY THE ROUTE LIVES WHERE IT DOES.
 *
 * The cookie is scoped to `/admin`, so it is never sent on a storefront request: a
 * shopper browsing `/shop` or posting the Help Desk form does not transmit an admin
 * credential, and neither does any third-party subresource on those pages. That is the
 * whole point of scoping it.
 *
 * Cookie paths match by prefix, so a cookie on `/admin` is NOT sent to `/api/...`. The
 * conventional place for this endpoint would have been `/api/admin/session`, which would
 * then have forced the cookie onto `/` to stay readable — undoing the scoping. So the
 * route is mounted at `/admin/api/session` instead, and every admin surface — pages,
 * the proxy, route handlers — sits under the one prefix the cookie covers.
 *
 * If a future admin API route is added under `/api/...` it will NOT see this cookie. That
 * is intentional. Put it under `/admin/api/...`.
 */
export const ADMIN_SESSION_PATH = '/admin'

/** Where the bridge lives. Exported so the proxy and tests cannot drift from the route. */
export const ADMIN_SESSION_ENDPOINT = '/admin/api/session'

/**
 * Hard ceiling on how long the cookie may live, regardless of what the token claims.
 *
 * The real lifetime comes from the token's own `exp` (see `cookieMaxAgeFor`): that is the
 * backend's decision and the only honest answer to "how long is this valid for". This cap
 * only stops a token with an absurd or far-future `exp` from turning into a long-lived
 * credential sitting in a browser.
 */
export const ADMIN_SESSION_MAX_AGE_CAP_SECONDS = 8 * 60 * 60

/**
 * Lifetime used when the token carries no readable `exp`.
 *
 * Deliberately short. A token whose expiry cannot be read is not a licence to pick a
 * generous number — the session simply has to be re-established sooner. Nothing is
 * invented about the backend's real lifetime here.
 */
export const ADMIN_SESSION_FALLBACK_MAX_AGE_SECONDS = 15 * 60

/**
 * True for a string shaped like a three-part JWT.
 *
 * A CHEAP PRE-FILTER, NOT A CHECK. Its only job is to reject obvious junk before a
 * network call — so a malformed body costs no round trip to the backend. Returning true
 * means "worth asking the backend about", never "valid" and never "admin".
 *
 * The segment pattern is base64url, which is what rules out a value carrying a `;`, a
 * newline or whitespace — none of which may ever reach a `Set-Cookie` header.
 */
export function looksLikeJwt(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const token = value.trim()
  // An upper bound as well as a lower one: a megabyte of base64 is not a session token,
  // and refusing it early keeps it out of the logs and off the wire.
  if (token.length < 20 || token.length > 4096) return false
  return /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
}

/**
 * The token's own `exp` claim, as a Unix timestamp in seconds, or null.
 *
 * Decodes the payload without verifying anything — see the warning at the top of the
 * file. Written with `atob` and no Node built-in so it runs in the Edge runtime too.
 */
export function readTokenExpiry(token: string): number | null {
  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const parsed: unknown = JSON.parse(atob(padded))
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null

    const exp = (parsed as { exp?: unknown }).exp
    return typeof exp === 'number' && Number.isFinite(exp) ? exp : null
  } catch {
    return null
  }
}

/**
 * How long the cookie should live, in seconds, for this token.
 *
 * Derived from the token's own expiry so the cookie cannot outlive the credential it
 * carries — "consistent with the actual backend token lifetime" means reading the
 * backend's number, not choosing one.
 *
 * Returns 0 for a token that has already expired, which callers treat as "do not set a
 * cookie at all". `nowSeconds` is a parameter purely so tests can pin the clock.
 */
export function cookieMaxAgeFor(token: string, nowSeconds = Math.floor(Date.now() / 1000)): number {
  const exp = readTokenExpiry(token)
  if (exp === null) return ADMIN_SESSION_FALLBACK_MAX_AGE_SECONDS

  const remaining = Math.floor(exp - nowSeconds)
  if (remaining <= 0) return 0
  return Math.min(remaining, ADMIN_SESSION_MAX_AGE_CAP_SECONDS)
}

/**
 * True when the token's own `exp` is in the past.
 *
 * Used as an early reject so an expired token is never forwarded to the backend, and so
 * the proxy can drop a stale cookie without a network call. A token that passes this is
 * NOT therefore valid — only not-obviously-expired.
 */
export function isExpiredByClaim(token: string, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const exp = readTokenExpiry(token)
  return exp !== null && exp - nowSeconds <= 0
}

/** The attributes every `Set-Cookie` for this session must carry. One definition, reused. */
export function adminCookieAttributes(maxAgeSeconds: number) {
  return {
    name: ADMIN_SESSION_COOKIE,
    httpOnly: true,
    /*
     * `secure` in production only.
     *
     * A `Secure` cookie is dropped by the browser over plain HTTP, so setting it
     * unconditionally would make the bridge silently fail on `http://localhost:3000` —
     * the one environment it has to work in for development. Keyed to NODE_ENV, which
     * `next build` sets to 'production', so every deployment gets it.
     */
    secure: process.env.NODE_ENV === 'production',
    /*
     * `lax`, not `strict`: the admin panel is reached by following a link, and `strict`
     * withholds the cookie on that first cross-site navigation, which would bounce an
     * admin to sign-in once for no reason. `lax` still withholds it from cross-site
     * POSTs, which is the case that matters.
     *
     * `none` would be wrong and is never used — it would attach the admin credential to
     * any third-party request.
     */
    sameSite: 'lax' as const,
    path: ADMIN_SESSION_PATH,
    maxAge: maxAgeSeconds,
  }
}
