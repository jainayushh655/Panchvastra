import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { loginAdmin } from '@/api/adminAuth'

const ADMIN_TOKEN_STORAGE_KEY = 'panchvastra-admin-token'
const ADMIN_EMAIL_STORAGE_KEY = 'panchvastra-admin-email'

type AdminUser = {
  email: string
}

type AdminAuthContextValue = {
  adminToken: string | null
  adminUser: AdminUser | null
  isAuthenticated: boolean
  /** Resolves to an error message on failure, or null on success. Never throws. */
  login: (email: string, password: string) => Promise<string | null>
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined)

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') {
      return null
    }

    return window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
  })

  const [adminUser, setAdminUser] = useState<AdminUser | null>(() => {
    if (typeof window === 'undefined') {
      return null
    }

    const storedEmail = window.localStorage.getItem(ADMIN_EMAIL_STORAGE_KEY)

    return storedEmail ? { email: storedEmail } : null
  })

  /**
   * Authenticates against the real backend (POST /v1/login_admin/) and stores the token
   * it returns. Admin state is only ever established from a successful backend response —
   * there is no local/offline credential check, and a customer session grants nothing here
   * (this provider reads its own storage key and never consults the customer token).
   *
   * The password is forwarded to the API and never stored, logged, or kept in state.
   */
  const login = useCallback(async (email: string, password: string): Promise<string | null> => {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) return 'Please enter your email address.'
    if (!password) return 'Please enter your password.'

    const result = await loginAdmin(normalizedEmail, password)

    if (!result.ok) return result.message

    setAdminToken(result.token)
    setAdminUser({ email: result.email ?? normalizedEmail })

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, result.token)
      window.localStorage.setItem(ADMIN_EMAIL_STORAGE_KEY, result.email ?? normalizedEmail)
    }

    return null
  }, [])

  const logout = useCallback(() => {
    setAdminToken(null)
    setAdminUser(null)

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
      window.localStorage.removeItem(ADMIN_EMAIL_STORAGE_KEY)
    }
  }, [])

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      adminToken,
      adminUser,
      isAuthenticated: Boolean(adminToken),
      login,
      logout,
    }),
    [adminToken, adminUser, login, logout],
  )

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)

  if (!context) {
    throw new Error('useAdminAuth must be used within AdminAuthProvider')
  }

  return context
}
