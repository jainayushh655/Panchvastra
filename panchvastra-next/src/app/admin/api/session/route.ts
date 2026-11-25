import { NextResponse, type NextRequest } from 'next/server'
import { verifyAdminToken } from '@/lib/adminSession.server'
import {
  adminCookieAttributes,
  cookieMaxAgeFor,
  looksLikeJwt,
} from '@/lib/adminSession'

/**
 * `POST|DELETE /admin/api/session` — the admin cookie bridge.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT THIS IS FOR
 * ──────────────────────────────────────────────────────────────────────────────
 * An admin signs in through the ordinary customer OTP flow (`/v1/login_user/` ->
 * `/v1/verify_email/`), which leaves a JWT in `localStorage`. The browser can use that
 * token; the SERVER cannot see it, because `localStorage` does not exist there — which is
 * why no admin route can currently be guarded before it renders.
 *
 * This endpoint is the bridge: the browser hands the token over once, the server VERIFIES
 * it against the backend, and on success mirrors it into an httpOnly cookie that
 * the Edge proxy and Server Components can read. The token is never readable from JavaScript
 * again afterwards.
 *
 * It is NOT a login endpoint. It issues nothing, authenticates nobody, and cannot create
 * a session that did not already exist — it can only reflect one the backend already
 * accepts.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ⚠️ THE TOKEN IN THE BODY IS NEVER TRUSTED
 * ──────────────────────────────────────────────────────────────────────────────
 * This is the entire security argument for this file, so it is worth being blunt: anyone
 * can POST here with anything. A JWT payload is base64, not a signature, so a caller can
 * trivially present `{"role_id": 1}`. Therefore:
 *
 *   - The body is shape-checked only to avoid a pointless round trip.
 *   - Authorization is established by SPENDING the token on a real admin-only backend
 *     endpoint (`verifyAdminToken`), and believing only the backend's status code.
 *   - The cookie is set ONLY for a 2xx from that call.
 *   - Everything else — not-admin, invalid, backend unreachable — sets no cookie and
 *     actively CLEARS any existing one.
 *
 * Verified against the real backend while building this: a well-formed JWT carrying
 * `role_id: 1` and a future `exp`, signed with the literal string `not_a_real_signature`,
 * is rejected with 401 by every authenticated endpoint on this API. Decoding is not proof;
 * the backend's answer is.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT IS NEVER LOGGED OR RETURNED
 * ──────────────────────────────────────────────────────────────────────────────
 * The token. Not in a log line, not in a response body, not in an error, not in a header
 * other than the `Set-Cookie` that is the point of the endpoint. Responses carry a status
 * and a short fixed reason code — never the backend's own error text, which on a 5xx can
 * contain a Django debug page.
 */

/** Node runtime: `verifyAdminToken` reads `process.env` through `lib/env.server`. */
export const runtime = 'nodejs'

/** An authorization decision must never be cached or prerendered. */
export const dynamic = 'force-dynamic'

/** Fixed, non-reflective reason codes. Safe to put on the wire. */
type Reason =
  | 'ok'
  | 'cleared'
  | 'malformed-body'
  | 'malformed-token'
  | 'expired-token'
  | 'not-admin'
  | 'invalid-token'
  | 'verification-unavailable'
  | 'cross-origin'

function reply(status: number, reason: Reason, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: status < 400, reason, ...extra }, { status })
}

/**
 * Same-origin enforcement for a state-changing request — the CSRF control.
 *
 * WHY IT IS NEEDED EVEN THOUGH THE COOKIE IS `SameSite=Lax`. `Lax` protects a cookie
 * being SENT on a cross-site POST. This endpoint's risk is the opposite direction: it
 * WRITES a cookie. Without this check, a page on another origin could POST a token of its
 * own choosing and plant an admin session in someone's browser — session fixation. The
 * attacker would have to own a real admin token for it to be of any use (the backend
 * check sees to that), but planting a session is not something to leave open.
 *
 * Two independent signals, either of which is sufficient:
 *   - `Sec-Fetch-Site: same-origin` — set by the browser, not by the page, so a script
 *     cannot forge it. Absent in older browsers, hence the fallback.
 *   - `Origin` matching this request's own origin.
 *
 * A request with NEITHER signal is REJECTED rather than allowed. That is the fail-closed
 * direction: a browser `fetch()` always provides at least one, so what gets refused here
 * is a non-browser client, which has no business establishing a browser session anyway.
 */
function isSameOrigin(request: NextRequest): boolean {
  const site = request.headers.get('sec-fetch-site')
  if (site) return site === 'same-origin'

  const origin = request.headers.get('origin')
  if (!origin) return false

  try {
    return new URL(origin).origin === new URL(request.url).origin
  } catch {
    return false
  }
}

/**
 * Expires the cookie, with the SAME attributes it was set with. That is what deletes it.
 *
 * ⚠️ THE MATCHING PATH IS THE LOAD-BEARING PART. A browser scopes a cookie by
 * (name, domain, path), so a deletion written against `/` would not touch the real cookie
 * on `/admin` and the session would quietly survive a logout. Reusing
 * `adminCookieAttributes` means the path — and `HttpOnly`, `Secure` and `SameSite` with
 * it — cannot drift from the values used when setting it, because they are the same
 * function call.
 *
 * ONE mechanism, not two. The first version of this called `.set()` and then
 * `.delete()`; `.delete()` emits its own bare `Set-Cookie` and simply replaced the
 * first, so the resulting header carried only `Path` — losing `HttpOnly` and `Secure`,
 * and dropping `Max-Age=0` in favour of `Expires=1970` alone. It did work (verified in a
 * real browser), but a deletion that silently discards the attributes it was told to use
 * is a trap for the next person. `maxAge: 0` alone makes Next emit both `Max-Age=0` and
 * a 1970 `Expires`, which is belt-and-braces across browsers, with every attribute intact.
 */
function clearCookie(response: NextResponse): NextResponse {
  response.cookies.set({ ...adminCookieAttributes(0), value: '' })
  return response
}

/**
 * Establish the session.
 *
 * Order matters, and it is cheapest-and-safest first: same-origin, then body shape, then
 * token shape, then expiry by claim, and only then the one network call. Each early
 * rejection also clears any existing cookie, so a failed refresh can never leave a stale
 * credential in place.
 */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    // No cookie is touched here: an unauthenticated cross-origin caller must not be able
    // to clear a legitimate admin's session either.
    return reply(403, 'cross-origin')
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return clearCookie(reply(400, 'malformed-body'))
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return clearCookie(reply(400, 'malformed-body'))
  }

  const token = (body as { token?: unknown }).token

  // Shape only. This says nothing about validity — see the header note.
  if (!looksLikeJwt(token)) {
    return clearCookie(reply(400, 'malformed-token'))
  }

  const maxAge = cookieMaxAgeFor(token)
  if (maxAge <= 0) {
    // Already expired by its own `exp`. Refused without asking the backend.
    return clearCookie(reply(401, 'expired-token'))
  }

  const verification = await verifyAdminToken(token)

  if (verification.status === 'not-admin') {
    /*
     * A genuine, authenticated shopper. This is the branch that must never grant
     * anything: a valid customer session is not an admin session, and the response says
     * so without hinting at what would have worked.
     */
    return clearCookie(reply(403, 'not-admin'))
  }

  if (verification.status === 'invalid') {
    return clearCookie(reply(401, 'invalid-token'))
  }

  if (verification.status === 'unavailable') {
    /*
     * The backend could not be reached, or answered something unusable. Fail CLOSED:
     * "cannot check" is never "allow". 503 so the caller can distinguish a transient
     * outage from a refusal and retry rather than sign the user out for good.
     */
    return clearCookie(reply(503, 'verification-unavailable'))
  }

  // Backend-confirmed admin, and only now.
  const response = reply(200, 'ok', { expiresIn: maxAge })
  response.cookies.set({ ...adminCookieAttributes(maxAge), value: token })
  return response
}

/**
 * End the session — logout, and confirmed expiry.
 *
 * Deliberately unconditional once same-origin: clearing a session must never depend on
 * the state being clearable, or a half-broken session could not be ended. There is no
 * token to validate and nothing to look up.
 */
export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) return reply(403, 'cross-origin')
  return clearCookie(reply(200, 'cleared'))
}

/**
 * Everything else is refused.
 *
 * GET is included on purpose: there must be no way to read this session over HTTP. A
 * handler that echoed the cookie back would undo `httpOnly` in one line. Server-side
 * callers use `getAdminAuthorization()` directly instead.
 *
 * `Allow` is set because a 405 without it is a less useful 405.
 */
function methodNotAllowed() {
  return NextResponse.json(
    { ok: false, reason: 'method-not-allowed' },
    { status: 405, headers: { Allow: 'POST, DELETE' } },
  )
}

export const GET = methodNotAllowed
export const PUT = methodNotAllowed
export const PATCH = methodNotAllowed
export const HEAD = methodNotAllowed
export const OPTIONS = methodNotAllowed
