import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { ENDPOINTS } from '@/services/endpoints'
import { apiOrigin } from '@/lib/env.server'
import { ADMIN_SESSION_COOKIE, isExpiredByClaim, looksLikeJwt } from '@/lib/adminSession'

/**
 * Server-side admin authorization. THE one place it is decided.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY A COOKIE IS NOT AN ANSWER
 * ──────────────────────────────────────────────────────────────────────────────
 * The browser chose what to put in that cookie. A JWT's payload is base64, not a
 * signature check — anyone can mint `{"role_id": 1}` and encode it. So neither the
 * PRESENCE of the cookie nor its DECODED CONTENTS may ever be treated as proof of
 * anything, and nothing in this file does.
 *
 * That this matters is not theoretical. Measured against the real backend during this
 * phase: a syntactically valid, correctly-shaped JWT carrying `role_id: 1` and a future
 * `exp`, signed with the literal string `not_a_real_signature`, was rejected with **401**
 * by `/v1/user_profile/`, `/v1/support_queries/`, `/v1/custom_requests/`, `/v1/notify_me/`
 * and `/v1/cart_management/`. The backend verifies signatures. It is the only party that
 * can, and therefore the only party asked here.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * HOW AUTHORIZATION IS ESTABLISHED
 * ──────────────────────────────────────────────────────────────────────────────
 * By spending the token on a real, read-only, ADMIN-ONLY backend endpoint and believing
 * the status code:
 *
 *     GET /v1/notify_me/?page=1&page_size=1      (the restock waitlist, all customers)
 *
 * The Vite application records this endpoint's authorization behaviour explicitly in
 * `src/api/notifyMe.ts`: *"This GET is admin-only (403 for a signed-in shopper, 401
 * without a token)"*. So the three outcomes are distinguishable and all three come from
 * the backend, not from this process:
 *
 *     2xx  -> the backend performed an admin-only read with this token  => ADMIN
 *     403  -> the backend authenticated the token and refused the read  => NOT ADMIN
 *     401  -> the backend rejected the credential itself                => INVALID
 *     else -> the backend did not answer usefully                       => UNAVAILABLE
 *
 * WHY THIS ENDPOINT. It is a GET, so it changes nothing and can be repeated safely; it is
 * documented as role-discriminating, which the other admin paths are not (`GET
 * /v1/custom_requests/` serves a customer their own requests, so a 200 there would prove
 * only that someone is signed in); and `page_size=1` keeps the probe to a single row
 * instead of pulling an inbox to answer a yes/no question.
 *
 * ⚠️ WHAT COULD NOT BE CONFIRMED HERE, stated plainly rather than assumed away: that a
 * valid NON-ADMIN shopper token really receives 403 on this path. Confirming it needs a
 * genuine shopper token and a genuine admin token, and this environment has neither — no
 * admin credentials exist and running a real OTP login is out of scope. The 403 branch is
 * therefore taken from the repository's own recorded contract, not from a live
 * observation. It fails CLOSED either way: anything that is not a 2xx denies access, so a
 * wrong guess about 403-vs-401 changes the error message, never the verdict. If the
 * backend ever answered 200 to a shopper on this path, the probe would be wrong — see
 * `ADMIN_PROBE` below, which exists as one constant so that is a one-line correction.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THIS IS NOT THE LAST LINE OF DEFENCE
 * ──────────────────────────────────────────────────────────────────────────────
 * Every admin endpoint still enforces its own permissions server-side, exactly as
 * `services/http/adminRequest.ts` records. This gate decides whether to RENDER an admin
 * page; the backend decides whether to serve admin DATA. Both remain in force, and this
 * file does not weaken the second one.
 */

/**
 * Thrown when a server-only helper is reached from the browser bundle.
 *
 * The same guard `lib/env.server.ts` uses, and for the same reason — it fails loudly
 * instead of quietly returning a wrong answer. `server-only` (the package Next normally
 * provides for this) is not resolvable in this project, and adding a dependency for one
 * import is not worth it when the established convention is right here.
 */
function assertServer(name: string): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      `${name} is server-only and was called in the browser. The admin session cookie is ` +
        'httpOnly and deliberately unreadable from client JavaScript — move this call into ' +
        'a Server Component or a Route Handler.',
    )
  }
}

/**
 * The admin-only probe. One constant, one place to correct if the backend's contract is
 * ever found to differ. Read-only and idempotent by construction.
 */
const ADMIN_PROBE = { path: ENDPOINTS.notifyMe, params: 'page=1&page_size=1' } as const

/** How long to wait for the backend before failing closed. */
const VERIFY_TIMEOUT_MS = 8000

export type AdminVerification =
  /** The backend performed an admin-only read with this token. */
  | { status: 'admin' }
  /** Authenticated, but the backend refused an admin-only read. */
  | { status: 'not-admin' }
  /** No token, or one the backend rejected, or one already expired by its own claim. */
  | { status: 'invalid' }
  /** The backend could not be reached or answered unusably. Access is still denied. */
  | { status: 'unavailable' }

/**
 * Asks the backend whether this token is an admin's.
 *
 * Takes the token as an argument rather than reading the cookie itself, so the Route
 * Handler can verify a token BEFORE any cookie exists — which is the whole point of the
 * bridge — and so this function is trivially testable.
 *
 * Never logs, returns or embeds the token. Never caches: an authorization decision that
 * could be served from a cache is not an authorization decision, hence `no-store`.
 */
export async function verifyAdminToken(token: string): Promise<AdminVerification> {
  assertServer('verifyAdminToken')
  if (!looksLikeJwt(token)) return { status: 'invalid' }

  // An expired token is refused without troubling the backend. Cheap, and it keeps a
  // stale credential off the wire entirely.
  if (isExpiredByClaim(token)) return { status: 'invalid' }

  const origin = apiOrigin()
  if (!origin) {
    // No backend to ask means no way to establish authorization — so none is granted.
    // This is the same fail-closed posture as a network failure, deliberately not an
    // "allow because we cannot check" path.
    console.warn('[adminSession] cannot verify an admin session: no API origin configured')
    return { status: 'unavailable' }
  }

  let response: Response
  try {
    response = await fetch(`${origin}${ADMIN_PROBE.path}?${ADMIN_PROBE.params}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
      // Never cached, never revalidated, never shared between visitors.
      cache: 'no-store',
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    })
  } catch {
    // A timeout or a DNS/TLS failure. The reason is not logged with the token anywhere
    // near it, and the verdict is denial.
    return { status: 'unavailable' }
  }

  if (response.ok) return { status: 'admin' }
  if (response.status === 403) return { status: 'not-admin' }
  if (response.status === 401) return { status: 'invalid' }
  return { status: 'unavailable' }
}

/**
 * The admin token from the httpOnly cookie, or null.
 *
 * SERVER ONLY — the `server-only` import at the top of this file makes importing it from a
 * Client Component a build error rather than a runtime surprise, so the value cannot be
 * handed to the browser by accident.
 *
 * Returns null for a missing cookie, a malformed value, and one that is already expired by
 * its own claim. The caller still has to VERIFY what it gets: holding a token is not being
 * an admin, and this function makes no claim that it is.
 */
export async function readAdminSessionToken(): Promise<string | null> {
  assertServer('readAdminSessionToken')
  const store = await cookies()
  const raw = store.get(ADMIN_SESSION_COOKIE)?.value

  if (!raw || !looksLikeJwt(raw)) return null
  if (isExpiredByClaim(raw)) return null

  return raw.trim()
}

/**
 * The whole check in one call, for a Server Component or a Route Handler under `/admin`.
 *
 * Reads the cookie and verifies it with the backend. `{ status: 'invalid' }` covers both
 * "no cookie" and "a cookie the backend rejected", because to a caller deciding whether
 * to render they are the same thing: not signed in as an admin.
 *
 * ⚠️ It returns a VERDICT, never the token. Nothing that calls this can leak the
 * credential into a page, a prop or a serialised payload, because it never receives it.
 */
export async function getAdminAuthorization(): Promise<AdminVerification> {
  const token = await readAdminSessionToken()
  if (!token) return { status: 'invalid' }
  return verifyAdminToken(token)
}

/** True only for a backend-confirmed admin. The convenience form of the above. */
export async function isAuthorizedAdmin(): Promise<boolean> {
  return (await getAdminAuthorization()).status === 'admin'
}

/**
 * Gate a protected admin PAGE, not just its layout. Call it before anything else.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY A LAYOUT GUARD ALONE IS NOT ENOUGH — measured, not theorised
 * ──────────────────────────────────────────────────────────────────────────────
 * `app/admin/(protected)/layout.tsx` awaits `getAdminAuthorization()` and redirects when
 * it fails, which is correct and is what sends an unauthorized caller away. But in the App
 * Router a layout and its page render CONCURRENTLY: the page does not wait for the
 * layout's `await` to settle.
 *
 * So the page runs anyway, and its output is serialised into the RSC flight payload that
 * Next inlines in the body of the redirect response. Verified against this application
 * during Phase 5B: a request to `/admin/dashboard` carrying a FORGED cookie answered
 * `307` — and its 14KB body contained the fully-rendered dashboard inside a `<script>`
 * tag, including every heading and list item.
 *
 * For that placeholder page the content was inert. For any of the eleven screens still to
 * come — orders, customers, support queries — the same mechanism would ship real admin
 * data to a caller who had just been refused. The redirect looks like a denial and is not
 * one.
 *
 * Awaiting this at the top of a page fixes it at the only point that can: the page's own
 * content is never produced, so there is nothing to serialise. The layout guard stays —
 * it is what renders the shell only for an admin, and it is the belt to this braces.
 *
 * ⚠️ EVERY protected admin page must call this FIRST, before any data fetch. A page that
 * fetches and then calls it has already done the work and already has the data in hand.
 *
 * No duplicated logic: this is a thin wrapper over `getAdminAuthorization()` above, which
 * remains the single place the question is answered.
 */
export async function requireAdmin(): Promise<void> {
  const authorization = await getAdminAuthorization()

  if (authorization.status !== 'admin') {
    /*
     * One destination for every failure mode, and no reason code in the URL — telling an
     * unauthorized caller whether they were "expired", "not an admin" or "unverifiable"
     * is free reconnaissance. The sign-in screen works out what to say from its own
     * verified state.
     */
    redirect('/admin/login')
  }
}
