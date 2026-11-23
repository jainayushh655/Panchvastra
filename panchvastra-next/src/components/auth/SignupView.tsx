'use client'

import type { FormEvent } from 'react'
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AuthPoster } from '@/components/auth/AuthPoster'
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout'
import { AuthSwitchLink } from '@/components/auth/AuthSwitchLink'
import { GOOGLE_BUTTON_MAX_WIDTH, GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { OtpVerifyStep } from '@/components/auth/OtpVerifyStep'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthProvider'
import { safeNextPath } from '@/lib/nextPath'
import { validateEmail, validateName } from '@/lib/formValidation'
import { registerUser } from '@/services/auth'
import { readApiMessage } from '@/services/http/apiMessage'

/**
 * Customer registration.
 *
 * Ported from the Vite `SignupPage`. The two-step flow (details, then code), the field
 * grid, every class, every validation rule and every message are unchanged.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT IS REUSED RATHER THAN REBUILT
 * ──────────────────────────────────────────────────────────────────────────────
 * Nothing about authentication is implemented here. The code step is the SAME
 * `OtpVerifyStep` the login screen renders, the verification goes through the SAME
 * `verifyOtpAndLogin` on `AuthProvider`, and Google uses the SAME
 * `loginWithGoogleCredential` and the SAME button component. So a session created by
 * signing up is established by exactly the code path that creates one by signing in —
 * same storage, same JWT validation, same role resolution, same expiry latch reset.
 *
 * This screen owns one request of its own, `registerUser`, and the presentation state
 * around it.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THERE IS DELIBERATELY NO RESEND HERE
 * ──────────────────────────────────────────────────────────────────────────────
 * Carried over from the Vite page, and worth restating because the login screen DOES have
 * one: the only thing that sends a registration code is the registration call itself, and
 * the backend documents no endpoint to re-issue a code for a pending sign-up. So
 * `OtpVerifyStep` is rendered without its `resend` prop and shows no countdown — going
 * back and submitting the form again is the honest route, rather than a button that
 * cannot do what it says. (`/v1/login_user/` would send a LOGIN code to an address that
 * may not be verified yet; using it here would be inventing a flow.)
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHERE IT GOES AFTERWARDS
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite page always goes to the homepage. This one honours `?next=` through the same
 * `safeNextPath` the login screen uses, so a customer who was sent to sign in for their
 * cart, and chose to create an account instead, still arrives at their cart. With no
 * `next`, or an unsafe one, it is the homepage — the Vite behaviour exactly.
 */
export function SignupView() {
  const router = useRouter()
  const { verifyOtpAndLogin, loginWithGoogleCredential } = useAuth()
  const [googleError, setGoogleError] = useState('')

  /**
   * Read at the moment of navigation rather than through `useSearchParams()`, which would
   * opt this prerendered route into client rendering. Validated on the way out, always.
   */
  const goToNext = useCallback(() => {
    const requested = new URLSearchParams(window.location.search).get('next')
    router.replace(safeNextPath(requested))
  }, [router])

  /**
   * A signup via Google is just an authentication result: the backend has already created
   * or matched the account, so this goes straight on like any other successful sign-in.
   * A new Google account has no phone number, but that does not divert the customer to the
   * profile screen — they can add one from their profile when they want to. No OTP, no
   * second Google call, and the registration API is not involved.
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

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  /**
   * Registration is a two-step flow in one column: the details form, then the code. The
   * second step REPLACES the first in the same panel — the same place the login screen
   * shows it — rather than opening a modal over it.
   */
  const [showOtpStep, setShowOtpStep] = useState(false)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [isOtpVerifying, setIsOtpVerifying] = useState(false)

  const inputClass =
    'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-black'

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()

    const firstNameErr = validateName(firstName)
    if (firstNameErr) {
      setError(firstNameErr)
      return
    }

    const lastNameErr = validateName(lastName)
    if (lastNameErr) {
      setError(lastNameErr)
      return
    }

    const emailErr = validateEmail(email)
    if (emailErr) {
      setError(emailErr)
      return
    }

    /*
     * Ten digits, and nothing more. `validatePhoneIndia` exists and additionally requires
     * a 6–9 leading digit, but this form has never applied that rule — adopting it here
     * would start rejecting numbers the live site accepts today. The input already strips
     * non-digits as it is typed, so this only has length left to check.
     */
    if (phoneNumber.length !== 10) {
      setError('Phone number must be exactly 10 digits.')
      return
    }

    setError('')
    setIsSubmitting(true)

    try {
      const response = await registerUser({
        first_name: firstName,
        last_name: lastName,
        email,
        phone_number: phoneNumber,
      })

      if (response.success) {
        setOtpError(null)
        setOtp('')
        setShowOtpStep(true)
      } else {
        setError(readApiMessage(response.message, 'Registration failed.'))
      }
    } catch (error: unknown) {
      /*
       * THE MESSAGE IS FLATTENED BEFORE IT IS SHOWN — a fix, not a port.
       *
       * This backend sends `message` as a string for business failures and as an OBJECT of
       * field -> string[] for validation failures, and both shapes come back from this
       * endpoint. The Vite page assigns it straight to the error state and renders it, so
       * the object form does not display badly — it throws "Objects are not valid as a
       * React child" and takes the whole sign-up screen down at the exact moment the
       * customer most needs to read what was wrong.
       *
       * `readApiMessage` is the shared reader the rest of this application already uses
       * (the login form carries its own private copy of the same logic, for the same
       * reason). A string is passed through untouched, so nothing changes for the common
       * case.
       */
      const response = (error as { response?: { data?: { message?: unknown } } }).response
      setError(readApiMessage(response?.data?.message, 'Registration failed.'))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleOtpVerify = async (event: FormEvent) => {
    event.preventDefault()

    if (otp.length !== 6) {
      setOtpError('Enter the 6-digit OTP.')
      return
    }

    setOtpError(null)
    setIsOtpVerifying(true)

    const result = await verifyOtpAndLogin({ email, otp })
    setIsOtpVerifying(false)

    if (!result.ok) {
      setOtpError(result.error)
      return
    }

    setShowOtpStep(false)
    goToNext()
  }

  return (
    <AuthSplitLayout
      // The brand poster stands alone: no overlaid wording, no scrim, no backend carousel.
      // The signup + OTP flow below is untouched.
      media={<AuthPoster />}
      mediaOnly
    >
      {/*
        Capped to the Google button's own 400px ceiling so CREATE ACCOUNT, the two-column
        field grid and the Google button all share one left and right edge. Applied here
        rather than in AuthSplitLayout, which is shared with the admin login.
      */}
      <div className="w-full" style={{ maxWidth: GOOGLE_BUTTON_MAX_WIDTH }}>
        {showOtpStep ? (
          /*
           * Step two, in the same column the form occupied — the registration details are
           * kept in state behind it, so going back does not retype them.
           */
          <OtpVerifyStep
            idPrefix="signup"
            eyebrow="One more step"
            heading="Verify Your Email"
            message="Enter the 6-digit OTP sent to"
            email={email}
            otp={otp}
            onOtpChange={(next) => {
              setOtp(next)
              setOtpError(null)
            }}
            error={otpError}
            isVerifying={isOtpVerifying}
            canVerify={otp.length === 6 && !isOtpVerifying}
            onSubmit={handleOtpVerify}
            backLabel="Back to sign up"
            onBack={() => {
              setShowOtpStep(false)
              setOtp('')
              setOtpError(null)
            }}
          />
        ) : (
          <div className="pv-auth-rise">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Create your account</p>

            <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight text-black">Sign up</h1>

            <p className="mt-2 text-sm text-zinc-600">
              Register once and continue with a smoother checkout flow.
            </p>

            {/*
              Two columns from `sm` up, one below it, so First/Last and Email/Phone pair up on a
              desktop panel but never get squeezed on a phone. `grid-cols-2` keeps the columns
              exactly equal; the full-width rows opt out with `col-span-2`.
            */}
            <form onSubmit={onSubmit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
              {/* First Name */}
              <div>
                <label
                  htmlFor="signup-firstname"
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600"
                >
                  First Name
                </label>

                <input
                  id="signup-firstname"
                  className={`${inputClass} mt-1`}
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value)
                    setError('')
                  }}
                />
              </div>

              {/* Last Name */}
              <div>
                <label
                  htmlFor="signup-lastname"
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600"
                >
                  Last Name
                </label>

                <input
                  id="signup-lastname"
                  className={`${inputClass} mt-1`}
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value)
                    setError('')
                  }}
                />
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="signup-email"
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600"
                >
                  Email
                </label>

                <input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  className={`${inputClass} mt-1`}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    setError('')
                  }}
                />
              </div>

              {/* Phone Number */}
              <div>
                <label
                  htmlFor="signup-phone"
                  className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600"
                >
                  Phone Number
                </label>

                <input
                  id="signup-phone"
                  type="tel"
                  className={`${inputClass} mt-1`}
                  placeholder="9876543210"
                  value={phoneNumber}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '')
                    setPhoneNumber(value)
                    setError('')
                  }}
                />
              </div>

              {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}

              {/* Spans the whole grid so its edges line up with the two-column block above. */}
              <Button
                type="submit"
                size="lg"
                className="w-full !border-chocolate !bg-chocolate !text-cream hover:!bg-espresso sm:col-span-2"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Creating...' : 'Create Account'}
              </Button>
            </form>

            <p className="mt-6 text-sm text-zinc-600">
              Already have an account?{' '}
              <AuthSwitchLink
                href="/login"
                className="font-semibold text-black underline underline-offset-2 hover:text-zinc-600"
              >
                Login
              </AuthSwitchLink>
            </p>

            {/*
              Google closes the form rather than opening it, with the SAME single OR divider
              moved down with it — the email registration above is the primary path and this is
              the alternative. It is the same component and the same handler the login screen
              uses; only its position in the page changed.
            */}
            <div className="mt-6">
              <div className="flex items-center gap-3" aria-hidden>
                <span className="h-px flex-1 bg-zinc-200" />
                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-400">or</span>
                <span className="h-px flex-1 bg-zinc-200" />
              </div>

              <div className="mt-5">
                <GoogleSignInButton onCredential={onGoogleCredential} text="signup_with" />
                <p aria-live="polite" className="min-h-0">
                  {googleError ? <span className="mt-3 block text-sm text-red-600">{googleError}</span> : null}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthSplitLayout>
  )
}
