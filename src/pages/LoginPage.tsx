import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { validateEmail } from '@/lib/formValidation'

export function LoginPage() {
  useDocumentTitle('Login')
  const navigate = useNavigate()
  const location = useLocation()
  const { sendOtpForEmail, verifyOtpAndLogin } = useAuth()
  const nextPath =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? ((location.state as { from: string }).from || '/')
      : '/'

  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [emailTouched, setEmailTouched] = useState(false)

  const inputClass =
    'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-black'
  const emailError = emailTouched ? validateEmail(email) : null
  const canSendOtp = !emailError && !isSending && countdown === 0
  const canVerifyOtp = otp.trim().length === 6 && !isVerifying
  const sendButtonLabel = otpSent && countdown > 0 ? 'Send OTP' : otpSent ? 'Resend OTP' : 'Send OTP'

  useEffect(() => {
    if (countdown <= 0) return

    const timer = window.setInterval(() => {
      setCountdown((value) => value - 1)
    }, 1000)

    return () => window.clearInterval(timer)
  }, [countdown])

  const handleEmailChange = (value: string) => {
    setEmail(value)
    setEmailTouched(true)
    setError('')
    setSuccess('')
    if (otpSent) {
      setOtpSent(false)
      setOtp('')
      setCountdown(0)
    }
  }

  const onSendOtp = async (e: FormEvent) => {
    e.preventDefault()

    const emailErr = validateEmail(email)
    setEmailTouched(true)
    if (emailErr) {
      setError(emailErr)
      setSuccess('')
      return
    }

    setError('')
    setSuccess('')
    setIsSending(true)

    const result = await sendOtpForEmail({ email })
    setIsSending(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setSuccess('OTP has been sent to your email.')
    setOtpSent(true)
    setOtp('')
    setCountdown(60)
  }

  const onVerifyOtp = async (e: FormEvent) => {
    e.preventDefault()

    const otpValue = otp.trim()
    if (otpValue.length !== 6) {
      setError('Enter the 6-digit OTP.')
      setSuccess('')
      return
    }

    setError('')
    setSuccess('')
    setIsVerifying(true)

    const result = await verifyOtpAndLogin({ email, otp: otpValue })
    setIsVerifying(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    navigate(nextPath, { replace: true })
  }

  return (
    <div className="min-h-svh bg-[#f7f7f5] px-4 py-14">
      <div className="mx-auto w-full max-w-md border border-zinc-200 bg-white p-7 shadow-[0_30px_60px_-36px_rgba(0,0,0,0.15)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Welcome back</p>
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight text-black">Login</h1>
        <p className="mt-2 text-sm text-zinc-600">Sign in to continue shopping your saved picks.</p>

        <form onSubmit={otpSent ? onVerifyOtp : onSendOtp} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className={`${inputClass} mt-1`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => handleEmailChange(e.target.value)}
            />
          </div>

          {emailError ? <p className="text-sm text-red-600">{emailError}</p> : null}

          {otpSent ? (
            <div>
              <label htmlFor="login-otp" className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
                OTP
              </label>
              <input
                id="login-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                className={`${inputClass} mt-1`}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))
                  setError('')
                  setSuccess('')
                }}
              />
            </div>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

          {otpSent ? (
            <div className="space-y-3">
              {countdown > 0 ? (
                <p className="text-sm text-zinc-600">Resend available in 00:{String(countdown).padStart(2, '0')}.</p>
              ) : null}

              <Button
                type="button"
                size="lg"
                className="w-full !border-black !bg-black !text-white hover:!bg-zinc-800"
                onClick={onSendOtp}
                disabled={!canSendOtp || countdown > 0 || isSending}
              >
                {isSending ? 'Sending...' : sendButtonLabel}
              </Button>

              <Button
                type="submit"
                size="lg"
                className="w-full !border-black !bg-black !text-white hover:!bg-zinc-800"
                disabled={!canVerifyOtp || isVerifying}
              >
                {isVerifying ? 'Verifying...' : 'Verify OTP'}
              </Button>
            </div>
          ) : (
            <Button
              type="submit"
              size="lg"
              className="w-full !border-black !bg-black !text-white hover:!bg-zinc-800"
              disabled={!canSendOtp}
            >
              {isSending ? 'Sending...' : 'Send OTP'}
            </Button>
          )}
        </form>

        <p className="mt-6 text-sm text-zinc-600">
          New here?{' '}
          <Link to="/signup" className="font-semibold text-black underline underline-offset-2 hover:text-zinc-600">
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
