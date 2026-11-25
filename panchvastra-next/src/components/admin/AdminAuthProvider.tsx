'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ADMIN_ROLE_ID, useAuth } from '@/context/AuthProvider'
import { readToken, syncAdminToken } from '@/services/http/authStorage'
import { clearAdminSessionCookie, syncAdminSessionCookie } from '@/services/adminSession'

/**
 * Admin session, derived from the ONE customer authentication session.
 *
 * Ported from the Vite `src/admin/context/AdminAuthProvider.tsx`. The authorization rule
 * is unchanged: there is no separate admin login, no separate token and no admin OTP
 * system — an admin signs in through the same `POST /v1/login_user/` ->
 * `POST /v1/verify_email/` flow as everyone else, and this provider answers only the
 * AUTHORIZATION question. Access requires `roleId === ADMIN_ROLE_ID`, which comes from the
 * backend and never from the email address.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT IS NEW HERE, AND WHY
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite version kept ONE representation of the admin session: a mirror of the JWT in
 * `localStorage`, read by `adminRequest.ts` to put an `Authorization` header on admin CRUD
 * calls. That is still here and unchanged.
 *
 * This version also drives the Phase 5A COOKIE bridge, because the server cannot read
 * `localStorage` and therefore could not guard an admin route before rendering it. So
 * every state change now fans out to both:
 *
 *     localStorage mirror  -> browser Authorization headers  (syncAdminToken)
 *     httpOnly cookie      -> server guard + Edge proxy      (syncAdminSessionCookie)
 *
 * ⚠️ THE TWO ARE NOT EQUALLY TRUSTED, and conflating them would undo Phase 5A. The
 * localStorage mirror is written here on the strength of a CLIENT-SIDE role check, which
 * is a UI decision and nothing more. The cookie is set by the server only after the
 * backend confirms the token on an admin-only endpoint — this provider cannot set it, it
 * can only ask. `isCookieVerified` below reports what the server actually said, and it is
 * deliberately separate from `isAuthenticated`.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THIS IS NOT ACCESS CONTROL
 * ──────────────────────────────────────────────────────────────────────────────
 * Nothing in this file protects anything. It decides what the admin UI renders. The guard
 * that matters is `getAdminAuthorization()` in the protected layout, which asks the
 * backend on every request, and behind that every admin endpoint enforces its own
 * permissions. A tampered `localStorage` value buys a rendered shell and no data.
 */

export type AdminUser = {
  email: string
}

/** What the SERVER said about the cookie, which is a different question from the above. */
export type AdminCookieState =
  /** Not attempted yet in this tab.  */
  | 'unknown'
  /** A sync is in flight. */
  | 'syncing'
  /** The backend confirmed an admin and the cookie is set. */
  | 'verified'
  /** The backend authenticated the token but refused admin access. */
  | 'refused'
  /** The backend could not be reached. Nothing was granted. */
  | 'unavailable'

type AdminAuthContextValue = {
  adminUser: AdminUser | null
  /**
   * True for a signed-in user whose backend-issued role is the admin role.
   *
   * ⚠️ A CLIENT-SIDE READ of a backend-issued claim. Good enough to decide what to render;
   * never good enough to decide what to serve. See the header note.
   */
  isAuthenticated: boolean
  /** Signed in as *someone* — tells "please sign in" apart from "not permitted". */
  isSignedIn: boolean
  /** False until the stored session has been read, so `null` is not mistaken for signed out. */
  isSessionLoaded: boolean
  /** Backend-issued role of the signed-in user, or null. */
  roleId: number | null
  /** What the server said when the cookie was last synchronised. */
  cookieState: AdminCookieState
  /** True only when the SERVER confirmed admin authorization for the cookie. */
  isCookieVerified: boolean
  /** Ask the server to (re-)verify and set the cookie. Returns the resulting state. */
  syncCookie: (options?: { force?: boolean }) => Promise<AdminCookieState>
  /** Ends the shared session and drops both the mirror and the cookie. */
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined)

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const { user, token, isSessionLoaded, logout: endSession } = useAuth()
  const [cookieState, setCookieState] = useState<AdminCookieState>('unknown')

  const roleId = user?.roleId ?? null
  const isSignedIn = Boolean(user && token)
  const isAdmin = isSignedIn && roleId === ADMIN_ROLE_ID
  const mirroredToken = isAdmin && token ? token : null

  /*
   * The localStorage mirror, kept in step with the session.
   *
   * Written through the shared `authStorage.syncAdminToken`, which is idempotent and only
   * touches storage when the value actually differs — so a double render under Strict Mode
   * is a no-op. Any non-admin state removes it, so admin CRUD fails closed rather than
   * inheriting a shopper's token.
   *
   * The Vite version ALSO called this during render, to close a one-tick gap: React runs
   * effects children-first, so the provider's effect fired after an admin page's own mount
   * effect, and that page's first request reached `adminAuthConfig()` before the key
   * existed. That is not needed here and is deliberately not reproduced — in this
   * architecture a protected page has already been authorized on the server before it
   * renders at all, so there is no first-paint request racing the key. Writing to
   * localStorage during render would also be a side effect in render, which React 19
   * strict mode rightly complains about.
   */
  useEffect(() => {
    syncAdminToken(mirroredToken)
  }, [mirroredToken])

  /**
   * Ask the server to verify the token and set the httpOnly cookie.
   *
   * The de-duplication lives in `services/adminSession.ts`, which remembers the last
   * token it successfully synchronised — so this can be called from an effect that runs on
   * every admin navigation without generating a backend verification per render. That
   * matters because each sync costs the server one upstream call.
   */
  const syncCookie = useCallback(
    async ({ force = false }: { force?: boolean } = {}): Promise<AdminCookieState> => {
      /*
       * ⚠️ THE TOKEN IS READ FROM STORAGE HERE, NOT FROM A RENDER CLOSURE.
       *
       * This was a real bug, found by driving the login in a browser. The first version
       * used the `mirroredToken` from the enclosing render. `OtpAuthForm` calls
       * `onAuthenticated` immediately after the session is written, so the login screen's
       * handler still held the closure from the render BEFORE the token existed — `null`.
       * `syncCookie` therefore cleared the cookie, returned 'unknown', and the screen
       * showed "Access denied" to a genuine admin. A beat later the provider's own effect
       * fired, POSTed the real token and got a 200 — but the denial was already on screen
       * and the effect's guard stopped it recovering.
       *
       * `readToken()` is synchronous and `writeSession()` has already run by the time
       * `onAuthenticated` fires, so reading storage at CALL time always sees the live
       * session. That removes the ordering dependency rather than papering over it.
       *
       * Note this asks the server about ANY stored session, not only one the client thinks
       * is an admin — which is the right way round. The client-side role check decides
       * what to render; the server decides what the cookie is worth, and a shopper's token
       * simply comes back `not-admin`.
       */
      const current = readToken()

      if (!current) {
        await clearAdminSessionCookie()
        setCookieState('unknown')
        return 'unknown'
      }

      setCookieState('syncing')
      const result = await syncAdminSessionCookie(current, { force })

      const next: AdminCookieState =
        result.status === 'ok'
          ? 'verified'
          : result.status === 'not-admin'
            ? 'refused'
            : result.status === 'unavailable'
              ? 'unavailable'
              : 'unknown'

      setCookieState(next)
      return next
    },
    [],
  )

  /*
   * Keep the cookie in step with the session for the life of the tab.
   *
   * Runs when the mirrored token changes — which covers signing in, signing out, and a
   * session restored on a fresh page load. The latch inside `syncAdminSessionCookie`
   * makes the repeat case free, and a fresh page load deliberately re-verifies because the
   * cookie may have lapsed while the tab was closed.
   */
  useEffect(() => {
    if (!isSessionLoaded) return

    if (!mirroredToken) {
      // Not an admin (or signed out): make sure no cookie survives the transition.
      void clearAdminSessionCookie().then(() => setCookieState('unknown'))
      return
    }

    void syncCookie()
  }, [isSessionLoaded, mirroredToken, syncCookie])

  /**
   * Ends the single shared session and drops BOTH representations.
   *
   * Order matters: the cookie is cleared first, while the token is still available, and
   * `endSession()` then clears the customer session and — through the effect above —
   * removes the localStorage mirror. Clearing the cookie is fire-and-forget by design (see
   * `clearAdminSessionCookie`): a network failure must not block someone signing out, and
   * the cookie's own `maxAge` bounds the exposure regardless.
   */
  const logout = useCallback(() => {
    void clearAdminSessionCookie()
    setCookieState('unknown')
    syncAdminToken(null)
    endSession()
  }, [endSession])

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      adminUser: isAdmin && user?.email ? { email: user.email } : null,
      isAuthenticated: isAdmin,
      isSignedIn,
      isSessionLoaded,
      roleId,
      cookieState,
      isCookieVerified: cookieState === 'verified',
      syncCookie,
      logout,
    }),
    [cookieState, isAdmin, isSessionLoaded, isSignedIn, logout, roleId, syncCookie, user],
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider')
  }
  return context
}
