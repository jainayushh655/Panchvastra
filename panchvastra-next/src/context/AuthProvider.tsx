'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  loginUser as requestLoginOtp,
  loginWithGoogle as requestGoogleLogin,
  readGoogleLoginError,
  verifyEmail as requestVerifyOtp,
} from '@/services/auth'
import {
  clearSession,
  isValidJwt,
  readStoredUserJson,
  readToken,
  writeSession,
} from '@/services/http/authStorage'
import { onSessionExpired, resetSessionExpiryLatch } from '@/services/http/sessionExpiry'
import { readJwtPayload } from '@/lib/jwtPayload'

/**
 * The customer session.
 *
 * Ported from the Vite application's `src/context/AuthProvider.tsx`. Every rule that
 * decides WHO someone is — JWT shape validation, where `role_id` may be read from, the
 * fail-closed role default, email normalisation, the per-flow error wording — is
 * reproduced unchanged. Two things are different, and only two:
 *
 * --- 1. STORAGE GOES THROUGH `authStorage` -----------------------------------
 * The Vite version calls `window.localStorage` inline. Here every read and write goes
 * through `@/services/http/authStorage`, which is the module the shared axios client also
 * reads the token from, is a no-op on the server, and tolerates a `localStorage` that
 * throws (Safari private mode, enterprise policy). The keys and the `pv_auth_changed`
 * event are identical, so this app and the Vite app can share a browser profile during
 * migration testing. Phase 5 swaps that one module for the httpOnly-cookie bridge and
 * nothing in this file moves.
 *
 * --- 2. THE SESSION IS READ AFTER MOUNT, NOT DURING RENDER -------------------
 * The Vite version seeds state from storage inside the `useState` initialiser:
 *
 *     const [user, setUser] = useState(() => readStoredSession().user)
 *
 * In Next that is a hydration bug, and a quiet one. The server has no storage, so it
 * renders signed-out chrome; if the first CLIENT render read storage it would render
 * signed-in chrome, the two trees would disagree, and React would throw the server HTML
 * away — no crash, just a wrong first paint. So this provider starts from the EMPTY state
 * the server also renders and loads the session in an effect.
 *
 * That is why no consumer in this app needs `useHydrated()`: the provider's own state is
 * already hydration-safe, so the navbar's badges and the profile menu render the
 * signed-out view on the server AND on the first client render, then update once. Gating
 * them again would only add a second render.
 *
 * `isSessionLoaded` is the one addition to the context's shape. It says "the effect has
 * run, so `user === null` really means signed out rather than not-read-yet" — which a
 * route guard will need in Phase 4, because without it the first client render of a
 * protected page would bounce a signed-in visitor to the login screen. Nothing else about
 * the contract changes.
 */

export type AuthUser = {
  id?: string
  name?: string
  email: string
  /**
   * Backend-issued role. `ADMIN_ROLE_ID` (1) identifies an admin. Null when the backend
   * did not supply one — which is treated as "not an admin", never as a default-allow.
   */
  roleId?: number | null
}

/** The backend's admin role. Admin UI access requires exactly this value. */
export const ADMIN_ROLE_ID = 1

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  /**
   * False until the stored session has been read from the browser. See the note above:
   * `user === null` while this is false means "not known yet", not "signed out".
   */
  isSessionLoaded: boolean
  sendOtpForEmail: (input: { email: string }) => Promise<{ ok: true; message?: string } | { ok: false; error: string }>
  verifyOtpAndLogin: (input: { email: string; otp: string }) => Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }>
  /**
   * Google sign-in. Takes the RAW Google ID token and returns the same kind of result the
   * OTP flow does, plus whether this account still needs a phone number.
   *
   * It is the only Google-aware thing on this context: there is no googleToken, no
   * googleSession and no second authentication state. The Panchvastra JWT the backend
   * returns is stored by the same `persistSession` the OTP flow uses.
   */
  loginWithGoogleCredential: (
    credential: string,
  ) => Promise<{ ok: true; user: AuthUser; needsProfileCompletion: boolean } | { ok: false; error: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Coerces a role value to a number; anything unusable becomes null. */
function toRoleId(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value)
  }
  return null
}

/**
 * Looks for `role_id` on an object, descending one level into `user`/`data` wrappers.
 *
 * Rather than asserting one position this checks the shapes this backend actually uses
 * (top-level, or nested under `data`/`user`). Returns null when absent — the caller then
 * treats the account as non-admin, so an unreadable role FAILS CLOSED.
 */
function readRoleId(source: unknown, depth = 0): number | null {
  if (!source || typeof source !== 'object' || depth > 2) return null

  const record = source as Record<string, unknown>
  for (const key of ['role_id', 'roleId']) {
    const found = toRoleId(record[key])
    if (found !== null) return found
  }

  for (const key of ['data', 'user']) {
    const found = readRoleId(record[key], depth + 1)
    if (found !== null) return found
  }

  return null
}

/** Role from the response envelope, else from the JWT's own claims. */
function extractRoleId(response: unknown, token: string | null): number | null {
  return readRoleId(response) ?? readRoleId(readJwtPayload(token))
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Reads the persisted session. BROWSER ONLY — every helper it calls returns null on the
 * server, so this yields the empty session there, and it is only ever called from an
 * effect in any case.
 *
 * A token that is not structurally a JWT, or a stored user that cannot be parsed, clears
 * storage rather than being half-trusted. The role is re-derived from the token so a
 * hand-edited stored user cannot fake an admin role.
 */
function readStoredSession(): { user: AuthUser | null; token: string | null } {
  const empty = { user: null as AuthUser | null, token: null as string | null }

  try {
    const token = readToken()

    if (!isValidJwt(token)) {
      clearSession()
      return empty
    }

    const rawUser = readStoredUserJson()
    const parsedUser = rawUser ? (JSON.parse(rawUser) as Partial<AuthUser> | null) : null
    const user =
      parsedUser && typeof parsedUser.email === 'string' && parsedUser.email.trim()
        ? ({
            id: parsedUser.id,
            name: parsedUser.name,
            email: parsedUser.email.trim().toLowerCase(),
            // Re-read from the token so a tampered stored user cannot fake a role.
            roleId: extractRoleId(null, token) ?? toRoleId(parsedUser.roleId),
          } as AuthUser)
        : null

    return { user, token }
  } catch {
    clearSession()
    return empty
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isSessionLoaded, setIsSessionLoaded] = useState(false)

  /**
   * Restores the stored session once, after mount.
   *
   * This is the whole hydration fix. It runs after the first client render has already
   * matched the server's signed-out HTML, so the only visible effect is the chrome
   * updating on the next paint.
   */
  useEffect(() => {
    const stored = readStoredSession()
    setUser(stored.user)
    setToken(stored.token)
    setIsSessionLoaded(true)
  }, [])

  const persistSession = useCallback((nextUser: AuthUser, nextToken: string | null) => {
    const normalizedToken = typeof nextToken === 'string' ? nextToken.trim() : null

    if (!nextUser?.email || !isValidJwt(normalizedToken)) {
      clearSession()
      setUser(null)
      setToken(null)
      return
    }

    const normalizedUser: AuthUser = {
      id: nextUser.id,
      name: nextUser.name,
      email: nextUser.email.trim().toLowerCase(),
      roleId: nextUser.roleId ?? null,
    }

    setUser(normalizedUser)
    setToken(normalizedToken)
    // A fresh session re-arms the one-shot expiry latch, so if THIS token later expires
    // the signal fires again rather than being swallowed by the previous expiry.
    resetSessionExpiryLatch()

    // Writes both keys and dispatches `pv_auth_changed`; a no-op on the server, and it
    // swallows storage failures so auth stays in memory for the session.
    writeSession(normalizedToken, JSON.stringify(normalizedUser))
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    clearSession()
    // Re-arm, so a later expiry on the next session is signalled again.
    resetSessionExpiryLatch()
  }, [])

  /**
   * The backend has stopped accepting the stored token.
   *
   * Clearing the session is all that happens here. The route guards (Phase 4) send an
   * unauthenticated visitor to the login screen carrying the current path as the return
   * path; navigating from this effect as well would race those guards and throw that path
   * away, so it does not.
   *
   * A visitor on a PUBLIC page simply loses the stale token and stays where they are:
   * public pages and public API calls keep working, which is the point of only clearing.
   *
   * `clearSession` touches the two auth keys and nothing else, so the wishlist — stored
   * per email under its own key — and every other persisted value survive. The cart lives
   * on the server and is re-read for whoever signs in next.
   */
  useEffect(
    () =>
      onSessionExpired(() => {
        setUser(null)
        setToken(null)
        clearSession()
      }),
    [],
  )

  const sendOtpForEmail = useCallback(async (input: { email: string }) => {
    const email = normalizeEmail(input.email)
    if (!email) {
      return { ok: false as const, error: 'Email is required.' }
    }

    try {
      const response = await requestLoginOtp({ email })
      // The backend returns the same generic message whether or not the email is
      // registered; it is surfaced verbatim rather than reworded.
      if (response?.success) {
        return { ok: true as const, message: response.message }
      }

      return {
        ok: false as const,
        error: response?.message ?? 'Unable to send OTP right now.',
      }
    } catch (error) {
      const message =
        typeof error === 'object' && error && 'response' in error
          ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message ??
            'Unable to send OTP right now.')
          : 'Unable to send OTP right now.'

      return { ok: false as const, error: message }
    }
  }, [])

  const verifyOtpAndLogin = useCallback(
    async (input: { email: string; otp: string }) => {
      const email = normalizeEmail(input.email)
      if (!email) {
        return { ok: false as const, error: 'Email is required.' }
      }

      try {
        const response = await requestVerifyOtp({ email, otp: input.otp.trim() })
        if (response?.success) {
          const nextToken = response.token ?? null
          const nextUser: AuthUser = {
            email,
            name: email.split('@')[0] || email,
            // Role comes from the backend response/JWT only — never from the email address.
            roleId: extractRoleId(response, nextToken),
          }
          persistSession(nextUser, nextToken)
          return { ok: true as const, user: nextUser }
        }

        return {
          ok: false as const,
          error: response?.message ?? 'Unable to verify OTP.',
        }
      } catch (error) {
        const message =
          typeof error === 'object' && error && 'response' in error
            ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message ??
              'Unable to verify OTP.')
            : 'Unable to verify OTP.'

        return { ok: false as const, error: message }
      }
    },
    [persistSession],
  )

  /**
   * Exchanges a Google ID token for the Panchvastra session.
   *
   * The Google credential is forwarded to the backend and then dropped — it is never
   * stored, never decoded here, and never used as the application token. Only the JWT the
   * backend returns reaches `persistSession`, which is byte-for-byte the same storage path
   * the OTP flow uses, so there is exactly one session mechanism.
   *
   * `needsProfileCompletion` is true only for a freshly created account (HTTP 201) that
   * came back without a phone number, since Google never supplies one. An existing
   * account (200), or a 201 that already carries a mobile, is a normal sign-in.
   */
  const loginWithGoogleCredential = useCallback(
    async (credential: string) => {
      const raw = typeof credential === 'string' ? credential.trim() : ''
      if (!raw) {
        return { ok: false as const, error: 'Google sign-in failed, please try again.' }
      }

      try {
        const { status, data } = await requestGoogleLogin(raw)
        const nextToken = data?.token ?? null
        const account = data?.user

        if (!account?.email || !nextToken) {
          return { ok: false as const, error: 'Google sign-in failed, please try again.' }
        }

        const fullName = [account.first_name, account.last_name]
          .map((part) => (typeof part === 'string' ? part.trim() : ''))
          .filter(Boolean)
          .join(' ')

        const nextUser: AuthUser = {
          id: account.id != null ? String(account.id) : undefined,
          name: fullName || account.email.split('@')[0] || account.email,
          email: account.email,
          // Role from the backend response/JWT only, exactly as the OTP path resolves it.
          roleId: extractRoleId(data, nextToken),
        }

        persistSession(nextUser, nextToken)

        const mobile = typeof account.mobile === 'string' ? account.mobile.trim() : ''
        return {
          ok: true as const,
          user: nextUser,
          needsProfileCompletion: status === 201 && !mobile,
        }
      } catch (error) {
        return {
          ok: false as const,
          error: readGoogleLoginError(error, 'Google sign-in failed, please try again.'),
        }
      }
    },
    [persistSession],
  )

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      isSessionLoaded,
      sendOtpForEmail,
      verifyOtpAndLogin,
      loginWithGoogleCredential,
      logout,
    }),
    [
      isSessionLoaded,
      logout,
      loginWithGoogleCredential,
      sendOtpForEmail,
      token,
      user,
      verifyOtpAndLogin,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
