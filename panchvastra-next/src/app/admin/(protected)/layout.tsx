import { AdminShell } from '@/components/admin/AdminShell'
import { requireAdmin } from '@/lib/adminSession.server'

/**
 * THE ADMIN GUARD. Every protected admin page passes through here, on the server, before
 * any of its content is rendered.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT MAKES THIS A REAL CHECK
 * ──────────────────────────────────────────────────────────────────────────────
 * `getAdminAuthorization()` (Phase 5A) reads the httpOnly cookie and spends the token on a
 * real, read-only, ADMIN-ONLY backend endpoint — `GET /v1/notify_me/?page=1&page_size=1`,
 * which the repository records as "403 for a signed-in shopper, 401 without a token". The
 * verdict is the backend's status code. Nothing here decodes a JWT and believes it; a
 * forged `role_id: 1` was measured against the real backend during Phase 5A and came back
 * 401.
 *
 * The verification logic is NOT duplicated. This file calls the Phase 5A helper and
 * branches on the result, and that helper is the only place the question is answered.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * FAIL CLOSED, IN EVERY DIRECTION
 * ──────────────────────────────────────────────────────────────────────────────
 *   invalid      — no cookie, malformed, expired, or a credential the backend rejected
 *   not-admin    — a genuine shopper's token; authenticated but refused
 *   unavailable  — the backend could not be reached, or answered unusably
 *
 * All three redirect. "Cannot check" is never "allow": an outage must not open the admin
 * panel, which is why `unavailable` redirects rather than rendering with a warning. Only
 * `{ status: 'admin' }` falls through to the shell.
 *
 * ⚠️ THE EDGE PROXY IS NOT THIS. `src/proxy.ts` turns away requests with no plausible
 * cookie, which keeps anonymous traffic off this path — but it cannot verify a signature
 * and explicitly grants nothing. A forged cookie reaches here and is refused by the
 * backend. Behind both, every admin endpoint still enforces its own permissions, which is
 * the check that ultimately protects the data.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * NO CACHED VERDICT, AND NO TOKEN LEAVING THE SERVER
 * ──────────────────────────────────────────────────────────────────────────────
 * `force-dynamic` plus the helper's own `cache: 'no-store'` means the authorization
 * question is asked on every request. A prerendered or cached admin page would be an
 * authorization decision frozen in time.
 *
 * `getAdminAuthorization()` returns a VERDICT, never the token — so nothing below can put
 * the credential into a prop, the HTML or a client bundle, because it never receives it.
 * The shell is given no session value at all; it reads the email it displays from the
 * client provider's own state.
 */

/** The verdict is per-request. Never prerender, never cache. */
export const dynamic = 'force-dynamic'

export default async function ProtectedAdminLayout({ children }: { children: React.ReactNode }) {
  /*
   * The shell renders only for a backend-confirmed admin.
   *
   * ⚠️ THIS IS NOT THE ONLY GATE, and it cannot be. A layout and its page render
   * CONCURRENTLY, so this `await` does not hold the page back — the page's output would
   * still be produced and still be serialised into the redirect's RSC payload. That was
   * measured, not assumed: see `requireAdmin`. Every protected page therefore awaits the
   * same helper itself, before any data fetch. This call guards the chrome; the page's own
   * call guards its content.
   *
   * `next` is not appended to the redirect: a layout receives no pathname in the App
   * Router, and the Edge proxy has already attached an accurate one for the ordinary
   * no-cookie case. A second, less accurate value would only fight it.
   */
  await requireAdmin()

  return <AdminShell>{children}</AdminShell>
}
