import { createContext, useCallback, useContext, useEffect, useMemo } from 'react'
import { ADMIN_ROLE_ID, useAuth } from '@/context/AuthProvider'

/**
 * Admin session, derived from the ONE customer authentication session.
 *
 * There is no separate admin login, no separate token and no separate OTP system any more:
 * an admin signs in through the same POST /v1/login_user/ -> POST /v1/verify_email/ flow as
 * everyone else, and this provider only answers the AUTHORIZATION question — is the
 * authenticated user's backend-issued role the admin role?
 *
 * Authentication (who you are) and authorization (what you may do) stay separate: a
 * successful OTP alone grants nothing here. Access requires `roleId === ADMIN_ROLE_ID`,
 * which comes from the backend response/JWT and never from the email address.
 *
 * The JWT is mirrored into the existing admin storage key so `adminRequest.ts` — and with
 * it every Categories/Products/Coupons CRUD call — keeps working completely unchanged. The
 * mirror is written ONLY for a role-1 user and removed otherwise, so a signed-in shopper
 * never has an admin key to send.
 */

const ADMIN_TOKEN_STORAGE_KEY = 'panchvastra-admin-token'

type AdminUser = {
  email: string
}

type AdminAuthContextValue = {
  adminToken: string | null
  adminUser: AdminUser | null
  /** True only for a signed-in user whose backend role is the admin role. */
  isAuthenticated: boolean
  /** Signed in as *someone* — used to tell "please sign in" apart from "not permitted". */
  isSignedIn: boolean
  /** Backend-issued role of the signed-in user, or null. */
  roleId: number | null
  logout: () => void
}

const AdminAuthContext = createContext<AdminAuthContextValue | undefined>(undefined)

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const { user, token, logout: endSession } = useAuth()

  const roleId = user?.roleId ?? null
  const isSignedIn = Boolean(user && token)
  const isAdmin = isSignedIn && roleId === ADMIN_ROLE_ID

  // Keep the admin key in step with the session, including across refreshes. Any
  // non-admin state removes it, so admin CRUD fails closed rather than inheriting a
  // shopper's token.
  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      if (isAdmin && token) {
        window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token)
      } else {
        window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
      }
    } catch {
      // Storage unavailable: admin requests will fail closed, which is the safe outcome.
    }
  }, [isAdmin, token])

  /** Ends the single shared session and drops the mirrored admin key with it. */
  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
      } catch {
        // Ignore storage errors; the session below is cleared regardless.
      }
    }

    endSession()
  }, [endSession])

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      adminToken: isAdmin ? token : null,
      adminUser: isAdmin && user?.email ? { email: user.email } : null,
      isAuthenticated: isAdmin,
      isSignedIn,
      roleId,
      logout,
    }),
    [isAdmin, isSignedIn, logout, roleId, token, user],
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
