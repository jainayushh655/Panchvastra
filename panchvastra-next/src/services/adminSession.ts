import { ADMIN_SESSION_ENDPOINT, looksLikeJwt } from '@/lib/adminSession'

/**
 * Browser side of the admin cookie bridge.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THERE ARE TWO STORES, AND WHAT EACH IS FOR
 * ──────────────────────────────────────────────────────────────────────────────
 * The admin token has to exist in two places because two different runtimes need it, and
 * neither can read the other's:
 *
 *   `localStorage` (`panchvastra-admin-token`)
 *       Read by `services/http/adminRequest.ts` to put an `Authorization` header on admin
 *       CRUD calls from the BROWSER. This is the existing mechanism, ported in Phase 2 and
 *       unchanged — every admin service written in a later phase keeps working as-is.
 *
 *   httpOnly cookie (`pv_admin_session`, path `/admin`)
 *       Read by `proxy.ts` and by Server Components via
 *       `lib/adminSession.server.ts`, so an admin route can be guarded and verified BEFORE
 *       it renders. Unreadable from JavaScript, which is the point.
 *
 * This module is the one-way link between them: it posts the already-stored token to the
 * bridge, which verifies it with the backend and sets the cookie. It never reads the
 * cookie (it cannot), and it is NOT a second authentication system — it synchronises one
 * session into a second representation.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHO CALLS THIS
 * ──────────────────────────────────────────────────────────────────────────────
 * Nobody yet. Phase 5A is the bridge only, with no admin login screen and no admin
 * provider — those are Phase 5B. The intended call sites are recorded here so the next
 * phase wires it up rather than reinventing it:
 *
 *   - After a sign-in that yields `role_id === 1`, beside the existing
 *     `syncAdminToken(token)` in `authStorage.ts`  ->  `syncAdminSessionCookie(token)`.
 *   - On logout, and on the `onSessionExpired` signal from
 *     `services/http/sessionExpiry.ts`            ->  `clearAdminSessionCookie()`.
 *
 * Keeping it unused-but-ready is deliberate: it is reviewable on its own, and the phase
 * that adds the UI does not also have to get the security model right at the same time.
 */

/** What the bridge decided. The token is never echoed back, so there is nothing to leak. */
export type AdminSessionSyncResult =
  /** Backend-confirmed admin; the httpOnly cookie is now set. */
  | { status: 'ok'; expiresIn: number }
  /** Authenticated, but the backend refused an admin-only read. Not an admin. */
  | { status: 'not-admin' }
  /** No usable token, or the backend rejected it. */
  | { status: 'invalid' }
  /** The backend could not be reached. No cookie was set; retrying later is reasonable. */
  | { status: 'unavailable' }

/**
 * The last token successfully synchronised, so a re-render cannot re-post it.
 *
 * WHY THIS EXISTS. The natural call site is a provider that renders on every admin
 * navigation. Without a latch, each render would fire a POST, each POST would make the
 * server spend the token on a backend verification call, and one admin clicking around
 * would generate a stream of upstream requests — the "repeated session synchronization"
 * failure. Holding the token value means the second call with the same token is free.
 *
 * It is module state, so it dies with the tab — which is correct: a fresh page load SHOULD
 * re-verify, because the cookie may have lapsed while the tab was closed.
 */
let lastSyncedToken: string | null = null

/**
 * Hand the token to the bridge so the server can verify it and set the cookie.
 *
 * Returns a verdict rather than throwing: the caller is UI code deciding what to render,
 * and an unreachable backend is not an exception so much as an answer. Nothing is logged,
 * because anything logged here would sit next to a credential.
 */
export async function syncAdminSessionCookie(
  token: string | null | undefined,
  { force = false }: { force?: boolean } = {},
): Promise<AdminSessionSyncResult> {
  // No token, or obvious junk: clear instead, so a stale cookie cannot outlive the
  // session it was mirroring.
  if (!looksLikeJwt(token)) {
    await clearAdminSessionCookie()
    return { status: 'invalid' }
  }

  if (!force && lastSyncedToken === token) {
    // Already mirrored in this tab. `force` exists for a deliberate re-check.
    return { status: 'ok', expiresIn: 0 }
  }

  let response: Response
  try {
    response = await fetch(ADMIN_SESSION_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `same-origin` is the default, but stating it makes the bridge's same-origin
      // requirement visible at the call site rather than only in the handler.
      credentials: 'same-origin',
      body: JSON.stringify({ token }),
    })
  } catch {
    return { status: 'unavailable' }
  }

  if (response.ok) {
    let expiresIn = 0
    try {
      const body: unknown = await response.json()
      const value = (body as { expiresIn?: unknown })?.expiresIn
      if (typeof value === 'number' && Number.isFinite(value)) expiresIn = value
    } catch {
      // The cookie is set either way; the number is only for a caller that wants to
      // schedule a refresh.
    }
    lastSyncedToken = token
    return { status: 'ok', expiresIn }
  }

  // A failed sync must not leave the latch holding a token the server rejected, or a
  // retry would be skipped.
  lastSyncedToken = null

  if (response.status === 403) {
    /*
     * 403 covers two cases the handler distinguishes by reason code: a genuine shopper
     * (`not-admin`) and a cross-origin caller. Only the first is worth reporting as
     * "not an admin"; the second is a configuration or attack condition and is reported
     * as invalid rather than implying the user's role.
     */
    let reason: unknown
    try {
      reason = ((await response.json()) as { reason?: unknown })?.reason
    } catch {
      reason = undefined
    }
    return reason === 'not-admin' ? { status: 'not-admin' } : { status: 'invalid' }
  }

  if (response.status === 503) return { status: 'unavailable' }
  return { status: 'invalid' }
}

/**
 * Drop the cookie — logout, or a confirmed expiry.
 *
 * Resolves even when the request fails. A caller clearing a session is on its way out and
 * must not be blocked by a network error; the cookie's own `maxAge` bounds the damage, and
 * the server verifies on every admin request regardless.
 */
export async function clearAdminSessionCookie(): Promise<void> {
  lastSyncedToken = null
  try {
    await fetch(ADMIN_SESSION_ENDPOINT, { method: 'DELETE', credentials: 'same-origin' })
  } catch {
    // Nothing to report and nothing to retry — see above.
  }
}

/** Test seam: forget the de-duplication latch. Not used by application code. */
export function resetAdminSessionSyncLatch(): void {
  lastSyncedToken = null
}
