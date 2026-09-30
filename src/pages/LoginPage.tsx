import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthCarousel } from '@/components/AuthCarousel'
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout'
import { GOOGLE_BUTTON_MAX_WIDTH, GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { OtpAuthForm } from '@/components/auth/OtpAuthForm'
import { useAuth } from '@/context/AuthProvider'
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

  const { loginWithGoogleCredential } = useAuth()
  const [googleError, setGoogleError] = useState('')

  /*
   * Google's result feeds the SAME destination logic the OTP flow uses — nothing special.
   *
   * A brand-new Google account comes back without a phone number (Google never supplies
   * one), but it is NOT diverted to the profile screen: signing in lands on the normal
   * next path like any other login. The customer can add a phone number from their profile
   * whenever they choose, and checkout still collects it where it is actually required.
   */
  const onGoogleCredential = useCallback(
    async (credential: string) => {
      setGoogleError('')
      const result = await loginWithGoogleCredential(credential)
      if (!result.ok) {
        setGoogleError(result.error)
        return
      }
      navigate(nextPath, { replace: true })
    },
    [loginWithGoogleCredential, navigate, nextPath],
  )

  return (
    <AuthSplitLayout
      eyebrow="Panchvastra"
      headline={<>New<br />Arrivals</>}
      // Brand imagery only — the OTP flow below is untouched.
      media={<AuthCarousel slideClassName="h-full" className="h-full" showSkeleton={false} />}
    >
      {/*
        Google enforces a 400px ceiling on its own button, so the column is capped to that
        same width and every control — Google, the email input, SEND OTP — shares one left
        and right edge instead of the button sitting 48px narrower than the rest. The
        wrapper is applied HERE rather than in AuthSplitLayout because that layout is
        shared with the admin login, which keeps its existing width.
      */}
      <div className="w-full" style={{ maxWidth: GOOGLE_BUTTON_MAX_WIDTH }}>
      <OtpAuthForm
        idPrefix="login"
        emailHeading="Login"
        emailSubtitle="Sign in to continue shopping your saved picks."
        onAuthenticated={() => navigate(nextPath, { replace: true })}
        /*
         * Everything below the email form lives in `footer`, which OtpAuthForm renders
         * after the form on the email step. That puts Google LAST — after the signup link —
         * so email + OTP reads as the primary path and Google as the alternative. The
         * single OR divider moved down with it; `aboveEmail` is no longer passed, so no
         * divider is left behind at the top and there is still exactly one of each.
         */
        footer={
          <>
            <p className="mt-6 text-sm text-zinc-600">
              New here?{' '}
              <Link to="/signup" className="font-semibold text-black underline underline-offset-2 hover:text-zinc-600">
                Create account
              </Link>
            </p>

            <div className="mt-6">
              <div className="flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-zinc-200" />
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-400">or</span>
                <span className="h-px flex-1 bg-zinc-200" />
              </div>

              <div className="mt-5">
                <GoogleSignInButton onCredential={onGoogleCredential} />
                <p aria-live="polite" className="min-h-0">
                  {googleError ? <span className="mt-3 block text-sm text-red-600">{googleError}</span> : null}
                </p>
              </div>
            </div>
          </>
        }
      />
      </div>
    </AuthSplitLayout>
  )
}
