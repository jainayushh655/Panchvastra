import { createContext, useContext, useMemo, useState } from 'react'

const ADMIN_TOKEN_STORAGE_KEY = 'panchvastra-admin-token'
const ADMIN_EMAIL_STORAGE_KEY = 'panchvastra-admin-email'

type AdminUser = {
  email: string
}

type AdminAuthContextValue = {
  adminToken: string | null
  adminUser: AdminUser | null
  isAuthenticated: boolean
  login: (email: string, password: string) => void
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

  const login = (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail || !password.trim()) {
      throw new Error('Please enter your email and password.')
    }

    setAdminToken('admin-token')
    setAdminUser({ email: normalizedEmail })

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, 'admin-token')
      window.localStorage.setItem(ADMIN_EMAIL_STORAGE_KEY, normalizedEmail)
    }
  }

  const logout = () => {
    setAdminToken(null)
    setAdminUser(null)

    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
      window.localStorage.removeItem(ADMIN_EMAIL_STORAGE_KEY)
    }
  }

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      adminToken,
      adminUser,
      isAuthenticated: Boolean(adminToken),
      login,
      logout,
    }),
    [adminToken, adminUser],
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
