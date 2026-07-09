import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { loginUser as requestLoginOtp, verifyEmail as requestVerifyOtp } from '@/api/auth'
import { KEYS, readJson, writeJson } from '@/lib/storage'

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

function readStoredSession() {
  const user = readJson<AuthUser | null>(KEYS.currentUser, null)
  const token = readJson<string | null>(KEYS.authToken, null)
  return { user, token }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredSession().user)
  const [token, setToken] = useState<string | null>(() => readStoredSession().token)

  const persistSession = useCallback((nextUser: AuthUser, nextToken: string | null) => {
    setUser(nextUser)
    setToken(nextToken)
    writeJson(KEYS.currentUser, nextUser)
    writeJson(KEYS.authToken, nextToken)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    writeJson(KEYS.currentUser, null)
    writeJson(KEYS.authToken, null)
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
