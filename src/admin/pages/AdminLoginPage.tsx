import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout'
import { OtpAuthForm } from '@/components/auth/OtpAuthForm'
import { useAdminAuth } from '@/admin/hooks/useAdminAuth'
import { ADMIN_ROLE_ID } from '@/context/AuthProvider'
import { Button } from '@/components/ui/Button'

/**
 * Admin sign-in — the SAME email -> OTP flow the storefront uses, followed by the role check.
 *
 * Only the presentation changed here: it now shares `AuthSplitLayout` and `OtpAuthForm` with
 * the customer login instead of keeping a second copy of the same state machine. The
 * authentication and authorization behaviour is untouched — POST /v1/login_user/ then
 * POST /v1/verify_email/ through the existing AuthProvider, no password, no admin-only
 * endpoint, and the panel opens only when the backend-issued role is the admin role.
 */
export function AdminLoginPage() {
  const navigate = useNavigate()
  const { isAuthenticated, isSignedIn, logout } = useAdminAuth()
  const [denied, setDenied] = useState(false)

  // Already signed in with the admin role — go straight through.
  if (isAuthenticated) {
    return <Navigate to="/admin/dashboard" replace />
  }

  // Signed in, but not an admin. The session stays: the person is a normal customer and is
  // not logged out merely for visiting /admin.
  if (denied || (isSignedIn && !isAuthenticated)) {
    return (
      <AuthSplitLayout eyebrow="Panchvastra" headline={<>Admin<br />Access</>} tagline="Manage the Panchvastra storefront.">
        <div className="pv-auth-rise">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Panchvastra Admin</p>
          <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight text-black">Access denied</h1>
          <p className="mt-3 text-sm text-zinc-600">You do not have permission to access the admin panel.</p>
          <p className="mt-2 text-sm text-zinc-600">You are still signed in and can continue shopping as usual.</p>

          <div className="mt-7 space-y-3">
            <Button
              type="button"
              size="lg"
              className="w-full !border-black !bg-black !text-white hover:!bg-zinc-800"
              onClick={() => navigate('/', { replace: true })}
            >
              Back to Panchvastra
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => {
                logout()
                setDenied(false)
              }}
            >
              Sign in with another account
            </Button>
          </div>
        </div>
      </AuthSplitLayout>
    )
  }

  return (
    <AuthSplitLayout eyebrow="Panchvastra" headline={<>Admin<br />Access</>} tagline="Manage the Panchvastra storefront.">
      <OtpAuthForm
        idPrefix="admin"
        emailHeading="Admin Login"
        emailSubtitle="Sign in with your email to manage the storefront."
        onAuthenticated={(user) => {
          // Authenticated — now authorize. Anything other than the admin role, including a
          // missing one, is refused.
          if (user.roleId !== ADMIN_ROLE_ID) {
            setDenied(true)
            return
          }

          navigate('/admin/dashboard', { replace: true })
        }}
      />
    </AuthSplitLayout>
  )
}
