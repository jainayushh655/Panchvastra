import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { loginUser as requestLoginOtp, verifyEmail as requestVerifyOtp } from '@/api/auth'

const AUTH_TOKEN_STORAGE_KEY = 'pv_auth_token_v1'
const CURRENT_USER_STORAGE_KEY = 'pv_current_user_v1'
const AUTH_EVENT = 'pv_auth_changed'
const JWT_PATTERN = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/

export type AuthUser = {
  id?: string
  name?: string
  email: string
}

type AuthContextValue = {
  user: AuthUser | null
  token: string | null
  isAuthenticated: boolean
  sendOtpForEmail: (input: { email: string }) => Promise<{ ok: true } | { ok: false; error: string }>
  verifyOtpAndLogin: (input: { email: string; otp: string }) => Promise<{ ok: true; user: AuthUser } | { ok: false; error: string }>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

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
      ? ({ id: parsedUser.id, name: parsedUser.name, email: parsedUser.email.trim().toLowerCase() } as AuthUser)
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
      if (response?.success) {
        return { ok: true as const }
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
        const nextUser: AuthUser = {
          email,
          name: email.split('@')[0] || email,
        }
        persistSession(nextUser, response.token ?? null)
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
