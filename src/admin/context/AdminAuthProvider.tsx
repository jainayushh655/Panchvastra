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

/**
 * Writes or clears the mirrored admin key.
 *
 * Called during render as well as from an effect, and that is deliberate. React runs
 * effects children-first, so this provider's effect fires AFTER the mount effect of
 * whichever admin page is being shown — which means that on a hard refresh of an admin
 * URL the page's own first request reached `adminAuthConfig()` before the key existed and
 * failed closed with "Your admin session has expired", despite a perfectly valid session.
 * Nothing retried, so the page simply sat on an error state.
 *
 * Writing during render closes that one-tick gap. It is idempotent and only touches
 * storage when the value actually differs, so a double render (StrictMode) is a no-op.
 * This does NOT widen access: the key is still written only for a role-1 user and removed
 * for everyone else, so a shopper never has an admin key to send.
 */
function syncAdminToken(token: string | null) {
  if (typeof window === 'undefined') return

  try {
    const current = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
    if (token) {
      if (current !== token) window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token)
    } else if (current !== null) {
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
    }
  } catch {
    // Storage unavailable: admin requests fail closed, which is the safe outcome.
  }
}

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
  const mirroredToken = isAdmin && token ? token : null

  // Synchronous, so the key is already in place before any child page's mount effect
  // issues its first admin request. See `syncAdminToken`.
  syncAdminToken(mirroredToken)

  // Keep the admin key in step with the session, including across refreshes. Any
  // non-admin state removes it, so admin CRUD fails closed rather than inheriting a
  // shopper's token.
  useEffect(() => {
    syncAdminToken(mirroredToken)
  }, [mirroredToken])

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
