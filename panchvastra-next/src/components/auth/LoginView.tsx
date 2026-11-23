'use client'

import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthPoster } from '@/components/auth/AuthPoster'
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout'
import { AuthSwitchLink } from '@/components/auth/AuthSwitchLink'
import { GOOGLE_BUTTON_MAX_WIDTH, GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { OtpAuthForm } from '@/components/auth/OtpAuthForm'
import { useAuth } from '@/context/AuthProvider'
import { safeNextPath } from '@/lib/nextPath'

/**
 * Customer sign-in.
 *
 * UI only: the email -> OTP state machine, the API calls and the session all live in
 * `OtpAuthForm` / `AuthProvider` exactly as before. This component supplies the
 * split-screen chrome and decides where to go once authentication succeeds.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE POST-LOGIN DESTINATION
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite page reads react-router's `location.state.from`, which only its own guard can
 * have written. Here the guard passes `?next=`, which ANYONE can write — so the value is
 * never used as given. `safeNextPath` is the only thing that turns it into a destination,
 * and it rejects absolute URLs, protocol-relative `//host`, the `/\host` variant, control
 * characters and a bounce back to this screen. See that module for the full reasoning.
 *
 * It is read at the MOMENT OF NAVIGATION (`window.location.search`) rather than through
 * `useSearchParams()`, because that hook makes a statically-rendered route bail out to
 * client rendering — and this value is needed only inside a handler, which is client-side
 * by definition. The sign-in screen stays prerenderable as a result.
 */
export function LoginView() {
  const router = useRouter()
  const { loginWithGoogleCredential } = useAuth()
  const [googleError, setGoogleError] = useState('')

  /** Back to wherever the guard sent them from, else home. Validated, always. */
  const goToNext = useCallback(() => {
    const requested = new URLSearchParams(window.location.search).get('next')
    // `replace`, as in the Vite page: the sign-in screen must not sit in the history
    // behind the page it just handed the customer to.
    router.replace(safeNextPath(requested))
  }, [router])

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
      goToNext()
    },
    [goToNext, loginWithGoogleCredential],
  )

  return (
    <AuthSplitLayout
      // The brand poster stands alone: no overlaid wording, no scrim, no backend carousel.
      // The OTP flow below is untouched.
      media={<AuthPoster />}
      mediaOnly
    >
      {/*
        Google enforces a 400px ceiling on its own button, so the column is capped to that
        same width and every control — Google, the email input, SEND OTP — shares one left
        and right edge instead of the button sitting 48px narrower than the rest.
      */}
      <div className="w-full" style={{ maxWidth: GOOGLE_BUTTON_MAX_WIDTH }}>
        <OtpAuthForm
          idPrefix="login"
          emailHeading="Login"
          emailSubtitle="Sign in to continue shopping your saved picks."
          onAuthenticated={goToNext}
          /*
           * Everything below the email form lives in `footer`, which OtpAuthForm renders
           * after the form on the email step. That puts Google LAST — after the signup link
           * — so email + OTP reads as the primary path and Google as the alternative.
           */
          footer={
            <>
              <p className="mt-6 text-sm text-zinc-600">
                New here?{' '}
                {/* Carries the return path across, so a customer who needs an account
                    first still arrives where the guard was sending them. */}
                <AuthSwitchLink
                  href="/signup"
                  className="font-semibold text-black underline underline-offset-2 hover:text-zinc-600"
                >
                  Create account
                </AuthSwitchLink>
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
