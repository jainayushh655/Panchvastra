import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout'
import { OtpAuthForm } from '@/components/auth/OtpAuthForm'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

/**
 * Customer sign-in.
 *
 * UI only: the email -> OTP state machine, the API calls and the session all live in
 * `OtpAuthForm` / `AuthProvider` exactly as before. This page supplies the split-screen
 * chrome and decides where to go once authentication succeeds.
 */
export function LoginPage() {
  useDocumentTitle('Login')
  const navigate = useNavigate()
  const location = useLocation()

  // Unchanged post-login destination: back to wherever the guard sent them from, else home.
  const nextPath =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? ((location.state as { from: string }).from || '/')
      : '/'

  return (
    <AuthSplitLayout eyebrow="Panchvastra" headline={<>New<br />Arrivals</>}>
      <OtpAuthForm
        idPrefix="login"
        emailHeading="Login"
        emailSubtitle="Sign in to continue shopping your saved picks."
        onAuthenticated={() => navigate(nextPath, { replace: true })}
        footer={
          <p className="mt-6 text-sm text-zinc-600">
            New here?{' '}
            <Link to="/signup" className="font-semibold text-black underline underline-offset-2 hover:text-zinc-600">
              Create account
            </Link>
          </p>
        }
      />
    </AuthSplitLayout>
  )
}
