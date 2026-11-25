import { NextResponse, type NextRequest } from 'next/server'
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_ENDPOINT,
  adminCookieAttributes,
  isExpiredByClaim,
  looksLikeJwt,
} from '@/lib/adminSession'

/**
 * Edge proxy (Next 16's renamed middleware). It guards `/admin/*` and touches nothing else.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ⚠️ WHAT THIS IS, AND THE MISTAKE IT MUST NOT BE
 * ──────────────────────────────────────────────────────────────────────────────
 * This is an EARLY ANONYMOUS-REQUEST GATE. Its entire job is to turn away a request that
 * obviously has no admin session, before any admin page is rendered or any admin data is
 * fetched — so an anonymous visitor to `/admin/orders` gets a redirect instead of a page
 * that then has to decide what to show.
 *
 * It is NOT authorization, and the difference is not pedantic:
 *
 *   - The proxy runs on the Edge and cannot verify a JWT signature. It has no access to
 *     the signing key, and it must not add a blocking backend round trip to every request.
 *   - So all it can see is THAT a cookie exists and that the value is shaped like a
 *     non-expired JWT. Anyone can produce that. It proves nothing.
 *
 * Therefore: **passing this gate grants nothing.** Every admin page and every admin route
 * handler must still call `getAdminAuthorization()` from `lib/adminSession.server.ts`,
 * which asks the BACKEND, before rendering admin content or serving admin data. And the
 * backend independently enforces permissions on every admin endpoint regardless. This
 * file is the outermost and weakest of three layers, and the only one an attacker can
 * influence.
 *
 * The practical consequence, stated so a later phase does not get it wrong: a forged
 * cookie buys an attacker exactly one thing — reaching the admin shell, which then asks
 * the backend and refuses. It does not buy a single row of admin data.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THE MATCHER IS SO NARROW
 * ──────────────────────────────────────────────────────────────────────────────
 * This is the first proxy in the application, so it arrives alongside a storefront
 * that is already finished and verified (Phase 4F-5: 160 checks, 16 routes). A broad
 * matcher would put every shopper request through this function, and the five protected
 * shopper routes — `/cart`, `/checkout`, `/orders`, `/profile`, `/wishlist` — have their
 * own client-side guard with its own `?next=` convention that this must not pre-empt or
 * duplicate.
 *
 * So the matcher names `/admin/:path*` and nothing else. No storefront route, no API
 * route, no static asset, no image reaches this code at all. Shopper authentication is
 * left exactly as Phase 4 built it.
 */

/** Where an unauthenticated admin request is sent. Phase 5B builds the page itself. */
const ADMIN_LOGIN_PATH = '/admin/login'

export function proxy(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl

  /*
   * The bridge endpoint is exempt, and it has to be.
   *
   * `POST /admin/api/session` is how the cookie gets set in the first place. Gating it on
   * having a cookie would be a deadlock: no session could ever be established, and
   * `DELETE` (logout) would stop working for anyone whose cookie had already lapsed.
   *
   * Exempting it is safe because that handler does its own same-origin check and its own
   * backend verification — it is the one place in the application that establishes
   * authorization, so it cannot depend on authorization already existing.
   */
  if (pathname === ADMIN_SESSION_ENDPOINT || pathname.startsWith('/admin/api/')) {
    return NextResponse.next()
  }

  /*
   * The login page is exempt for the obvious reason, and the guard below would otherwise
   * redirect it to itself forever. This is the infinite-redirect case, handled explicitly
   * rather than relying on the redirect target happening to fall outside the matcher.
   */
  if (pathname === ADMIN_LOGIN_PATH) {
    return NextResponse.next()
  }

  const cookie = request.cookies.get(ADMIN_SESSION_COOKIE)?.value

  // No cookie at all: the ordinary anonymous case.
  if (!cookie) {
    return redirectToLogin(request, pathname, search)
  }

  /*
   * A cookie that is junk, or expired by its own claim, is treated as no cookie AND
   * actively deleted on the way past.
   *
   * Dropping it here matters for a reason beyond tidiness: without it, a stale cookie
   * would keep passing this gate, the admin page would keep asking the backend, and the
   * backend would keep refusing — a request amplifier that produces one upstream call per
   * navigation and never resolves itself. Deleting it converts that into a single clean
   * redirect. (`isExpiredByClaim` reads the token's own `exp` without verifying it, which
   * is sound for this purpose: the claim can only be used to deny.)
   */
  if (!looksLikeJwt(cookie) || isExpiredByClaim(cookie)) {
    const response = redirectToLogin(request, pathname, search)
    /*
     * Expired with the SAME attributes it was set with — `adminCookieAttributes` is the
     * single source of those, so the path (and `HttpOnly`, `Secure`, `SameSite`) cannot
     * drift from the setter's. `.delete()` would emit a bare `Set-Cookie` carrying only
     * the path, which works but discards the rest; the session route makes the same
     * choice for the same reason.
     */
    response.cookies.set({ ...adminCookieAttributes(0), value: '' })
    return response
  }

  /*
   * A plausibly-shaped, unexpired cookie. The request proceeds — and the page it reaches
   * is still required to verify with the backend before rendering anything. See the
   * header note: this is not a grant.
   */
  return NextResponse.next()
}

/**
 * Redirect to the admin sign-in screen, carrying where to come back to.
 *
 * `next=` uses the same convention the storefront's `ProtectedRoute` established in Phase
 * 4, so there is one idea of "return path" in the application rather than two. The value
 * is read back through `safeNextPath` (`lib/nextPath.ts`), which rejects anything that is
 * not an internal path — so this cannot become an open redirect.
 *
 * `307`, not `302`: it preserves the method and body, so an admin whose cookie lapsed
 * mid-action is not silently converted into a GET.
 */
function redirectToLogin(request: NextRequest, pathname: string, search: string): NextResponse {
  const url = request.nextUrl.clone()
  url.pathname = ADMIN_LOGIN_PATH
  url.search = ''
  url.searchParams.set('next', `${pathname}${search}`)
  return NextResponse.redirect(url, 307)
}

/**
 * ⚠️ `/admin/:path*` ONLY — see the header note before widening this.
 *
 * `/admin` itself is listed separately because `:path*` does not match an empty segment.
 * Nothing storefront-facing appears here, which is what keeps the verified Phase 4 routes
 * out of this code path entirely.
 */
export const config = {
  matcher: ['/admin', '/admin/:path*'],
}
