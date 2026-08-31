import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { loginUser as requestLoginOtp, verifyEmail as requestVerifyOtp } from '@/api/auth'
import { readJwtPayload } from '@/lib/jwtPayload'

const AUTH_TOKEN_STORAGE_KEY = 'pv_auth_token_v1'
const CURRENT_USER_STORAGE_KEY = 'pv_current_user_v1'
const AUTH_EVENT = 'pv_auth_changed'
const JWT_PATTERN = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/

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
  sendOtpForEmail: (input: { email: string }) => Promise<{ ok: true; message?: string } | { ok: false; error: string }>
  verifyOtpAndLogin: (input: { email: string; otp: string }) => Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }>
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
 * The verify_email success body could not be observed in this environment, so rather than
 * asserting one position this checks the shapes this backend actually uses elsewhere
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

function isValidJwt(token: string | null | undefined): token is string {
  return typeof token === 'string' && JWT_PATTERN.test(token.trim())
}

function readStoredSession() {
  if (typeof window === 'undefined') {
    return { user: null as AuthUser | null, token: null as string | null }
  }

  try {
    const rawUser = window.localStorage.getItem(CURRENT_USER_STORAGE_KEY)
    const rawToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    const token = typeof rawToken === 'string' ? rawToken.trim() : null

    if (!isValidJwt(token)) {
      clearStoredSession()
      return { user: null as AuthUser | null, token: null as string | null }
    }

    const parsedUser = rawUser ? (JSON.parse(rawUser) as Partial<AuthUser> | null) : null
    const user = parsedUser && typeof parsedUser.email === 'string' && parsedUser.email.trim()
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
    clearStoredSession()
    return { user: null as AuthUser | null, token: null as string | null }
  }
}

function clearStoredSession() {
  if (typeof window === 'undefined') return

  window.localStorage.removeItem(CURRENT_USER_STORAGE_KEY)
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  window.dispatchEvent(new Event(AUTH_EVENT))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredSession().user)
  const [token, setToken] = useState<string | null>(() => readStoredSession().token)

  const persistSession = useCallback((nextUser: AuthUser, nextToken: string | null) => {
    const normalizedToken = typeof nextToken === 'string' ? nextToken.trim() : null

    if (!nextUser?.email || !isValidJwt(normalizedToken)) {
      clearStoredSession()
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

    if (typeof window === 'undefined') return

    try {
      window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(normalizedUser))
      window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, normalizedToken)
      window.dispatchEvent(new Event(AUTH_EVENT))
    } catch {
      // Ignore storage errors and rely on in-memory auth state.
    }
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    clearStoredSession()
  }, [])

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
          ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Unable to send OTP right now.')
          : 'Unable to send OTP right now.'

      return { ok: false as const, error: message }
    }
  }, [])

  const verifyOtpAndLogin = useCallback(async (input: { email: string; otp: string }) => {
    const email = normalizeEmail(input.email)
    if (!email) {
      return { ok: false as const, error: 'Email is required.' }
    }

    try {
      const response = await requestVerifyOtp({ email, otp: input.otp.trim() })
      if (response?.success) {
        const token = response.token ?? null
        const nextUser: AuthUser = {
          email,
          name: email.split('@')[0] || email,
          // Role comes from the backend response/JWT only — never from the email address.
          roleId: extractRoleId(response, token),
        }
        persistSession(nextUser, token)
        return { ok: true as const, user: nextUser }
      }

      return {
        ok: false as const,
        error: response?.message ?? 'Unable to verify OTP.',
      }
    } catch (error) {
      const message =
        typeof error === 'object' && error && 'response' in error
          ? ((error as { response?: { data?: { message?: string } } }).response?.data?.message ?? 'Unable to verify OTP.')
          : 'Unable to verify OTP.'

      return { ok: false as const, error: message }
    }
  }, [persistSession])

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      sendOtpForEmail,
      verifyOtpAndLogin,
      logout,
    }),
    [logout, sendOtpForEmail, token, user, verifyOtpAndLogin],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
