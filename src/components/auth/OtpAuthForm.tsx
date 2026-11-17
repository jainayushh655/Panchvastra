import type { FormEvent } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { OtpVerifyStep } from '@/components/auth/OtpVerifyStep'
import { type AuthUser, useAuth } from '@/context/AuthProvider'
import { validateEmail } from '@/lib/formValidation'

const RESEND_SECONDS = 30

/**
 * This backend sends `message` as a string, or as an object of field -> string[] on 400
 * validation errors. Rendering the object form directly crashes React, so anything that is
 * not already a string is flattened to a single displayable line.
 */
function asText(value: unknown, fallback: string): string {
  if (typeof value === 'string' && value.trim()) return value

  if (value && typeof value === 'object') {
    const parts: string[] = []
    for (const entry of Object.values(value as Record<string, unknown>)) {
      if (Array.isArray(entry)) parts.push(...entry.filter((v): v is string => typeof v === 'string'))
      else if (typeof entry === 'string') parts.push(entry)
    }
    if (parts.length) return parts.join(' ')
  }

  return fallback
}

/**
 * The email -> OTP authentication form, shared by the customer login screen and the admin
 * login screen.
 *
 * This is a UI shell around the EXISTING `useAuth()` calls — it owns only presentation state
 * (which step is showing, the countdown, in-flight flags). It does not talk to the API
 * directly, does not touch tokens or the session, and does not decide what happens after a
 * successful verification: the page supplies `onAuthenticated`, so the customer page can
 * navigate and the admin page can run its role check. Extracted so both screens share one
 * state machine instead of two copies.
 */
export function OtpAuthForm({
  idPrefix,
  emailHeading,
  emailSubtitle,
  onAuthenticated,
  footer,
  aboveEmail,
}: {
  /** Namespaces input ids so two instances could never collide. */
  idPrefix: string
  emailHeading: string
  emailSubtitle: string
  /** Called with the authenticated user once verification succeeds. */
  onAuthenticated: (user: AuthUser) => void
  footer?: React.ReactNode
  /**
   * Optional block rendered above the email field on the FIRST step only — the customer
   * screens pass "Continue with Google" here.
   *
   * A slot rather than a built-in button because this form is shared with the admin login,
   * which must stay email + OTP only. Omitting it leaves that screen byte-for-byte as it
   * was, and it never appears on the OTP step where it would compete with the code input.
   */
  aboveEmail?: React.ReactNode
}) {
  const { sendOtpForEmail, verifyOtpAndLogin } = useAuth()

  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [emailTouched, setEmailTouched] = useState(false)

  // Synchronous guards. The `isSending`/`isVerifying` state flags update a tick too late to
  // stop several clicks dispatched within one tick. One guard per API call, shared by the
  // initial send and the resend because both hit the same endpoint.
  const sendingRef = useRef(false)
  const verifyingRef = useRef(false)

  const emailError = emailTouched ? validateEmail(email) : null
  const canSend = !emailError && !isSending
  const canVerify = otp.length === 6 && !isVerifying

  // Simple countdown, cleared on unmount and whenever it restarts. No polling.
  useEffect(() => {
    if (countdown <= 0) return

    const timer = window.setInterval(() => {
      setCountdown((value) => (value <= 1 ? 0 : value - 1))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [countdown])

  useEffect(() => {
    if (!notice) return

    const timer = window.setTimeout(() => setNotice(''), 2000)
    return () => window.clearTimeout(timer)
  }, [notice])

  // Focus moves to the first OTP box as the step appears (the input's own `autoFocus`),
  // so keyboard users aren't stranded.

  /** Shared by the first Send OTP and every Resend — one request path, one guard. */
  const requestOtp = useCallback(
    async (address: string, { isResend }: { isResend: boolean }) => {
      if (sendingRef.current) return
      sendingRef.current = true

      setError('')
      setNotice('')
      setIsSending(true)

      const result = await sendOtpForEmail({ email: address })

      sendingRef.current = false
      setIsSending(false)

      if (!result.ok) {
        // A failed resend must NOT restart the countdown — the user keeps whatever time
        // was already left (or none) and can try again.
        setError(asText(result.error, 'Unable to send OTP right now. Please try again.'))
        return
      }

      // The backend returns the same generic message whether or not the email is
      // registered; it is shown verbatim rather than reworded.
      setNotice(result.message || 'OTP has been sent to your email.')
      setOtpSent(true)
      if (isResend) setOtp('')
      setCountdown(RESEND_SECONDS)
    },
    [sendOtpForEmail],
  )

  const onSendOtp = async (event: FormEvent) => {
    event.preventDefault()

    setEmailTouched(true)
    const invalid = validateEmail(email)
    if (invalid) {
      setError(invalid)
      setNotice('')
      return
    }

    await requestOtp(email, { isResend: false })
  }

  const onResend = async () => {
    if (countdown > 0 || isSending) return
    await requestOtp(email, { isResend: true })
  }

  const onVerifyOtp = async (event: FormEvent) => {
    event.preventDefault()

    if (otp.length !== 6) {
      setError('Enter the 6-digit OTP.')
      return
    }

    if (verifyingRef.current) return
    verifyingRef.current = true

    setError('')
    setNotice('')
    setIsVerifying(true)

    const result = await verifyOtpAndLogin({ email, otp })

    verifyingRef.current = false
    setIsVerifying(false)

    if (!result.ok) {
      // Stay on this step, keep the email, allow another attempt.
      setError(asText(result.error, 'Unable to verify OTP. Please try again.'))
      return
    }

    onAuthenticated(result.user)
  }

  const inputClass =
    'w-full border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-black focus:ring-2 focus:ring-black/10'
  const labelClass = 'text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600'
  const primaryButton = 'w-full !border-black !bg-black !text-white hover:!bg-zinc-800'

  // ------------------------------------------------------------------ OTP step
  if (otpSent) {
    return (
      <>
        <OtpVerifyStep
          idPrefix={idPrefix}
          eyebrow="Welcome back"
          heading="Verify OTP"
          message="We sent a verification code to"
          email={email}
          otp={otp}
          onOtpChange={(next) => {
            setOtp(next)
            setError('')
            setNotice('')
          }}
          error={error}
          isVerifying={isVerifying}
          canVerify={canVerify}
          onSubmit={onVerifyOtp}
          resend={{ countdown, isSending, onResend }}
          backLabel="Use a different email"
          onBack={() => {
            setOtpSent(false)
            setOtp('')
            setError('')
            setNotice('')
            setCountdown(0)
          }}
        />

        {notice ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-5 right-5 z-50 max-w-[calc(100vw-2.5rem)] bg-zinc-800 px-4 py-3 text-sm font-medium text-white shadow-lg"
          >
            {notice}
          </div>
        ) : null}
      </>
    )
  }

  // ---------------------------------------------------------------- email step
  return (
    <div className="pv-auth-rise" key="email-step">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Welcome back</p>
      <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight text-black">{emailHeading}</h1>
      <p className="mt-2 text-sm text-zinc-600">{emailSubtitle}</p>

      {aboveEmail ? (
        <div className="mt-7">
          {aboveEmail}

          {/* Hairline with a centred "OR", in the existing black/white language. */}
          <div className="mt-5 flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-zinc-200" />
            <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-400">or</span>
            <span className="h-px flex-1 bg-zinc-200" />
          </div>
        </div>
      ) : null}

      <form onSubmit={onSendOtp} className="mt-7 space-y-4" noValidate>
        <div>
          <label htmlFor={`${idPrefix}-email`} className={labelClass}>
            Email
          </label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setEmailTouched(true)
              setError('')
              setNotice('')
            }}
            placeholder="you@example.com"
            aria-describedby={`${idPrefix}-email-status`}
            aria-invalid={emailError || error ? true : undefined}
            className={`${inputClass} mt-1`}
          />
        </div>

        <div id={`${idPrefix}-email-status`} aria-live="polite" className="min-h-0">
          {emailError ? <p className="text-sm text-red-600">{emailError}</p> : null}
          {!emailError && error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <Button type="submit" size="lg" className={primaryButton} disabled={!canSend}>
          {isSending ? 'Sending...' : 'Send OTP'}
        </Button>
      </form>

      {footer}
    </div>
  )
}
