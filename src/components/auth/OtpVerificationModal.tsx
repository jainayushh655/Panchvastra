import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

type OtpVerificationModalProps = {
  isOpen: boolean
  email: string
  title?: string
  message?: string
  error?: string | null
  success?: string | null
  isVerifying?: boolean
  isResending?: boolean
  canResend?: boolean
  submitLabel?: string
  onVerify: (otp: string) => Promise<void> | void
  onResend?: () => Promise<void> | void
  onCancel: () => void
}

export function OtpVerificationModal({
  isOpen,
  email,
  title = 'Verify Your Email',
  message = 'Enter the 6-digit OTP sent to your email.',
  error,
  success,
  isVerifying = false,
  isResending = false,
  canResend = true,
  submitLabel = 'Verify OTP',
  onVerify,
  onResend,
  onCancel,
}: OtpVerificationModalProps) {
  const [otp, setOtp] = useState('')
  const [validationError, setValidationError] = useState('')

  useEffect(() => {
    if (!isOpen) {
      setOtp('')
      setValidationError('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    const otpValue = otp.trim()
    if (otpValue.length !== 6) {
      setValidationError('Enter the 6-digit OTP.')
      return
    }

    setValidationError('')
    await onVerify(otpValue)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-3xl border border-[#e5cfaa] bg-white/95 p-6 shadow-[0_30px_60px_-36px_rgba(0,0,0,0.4)] backdrop-blur"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8a7355]">One more step</p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#b07f2e]">{title}</h2>
        <p className="mt-2 text-sm text-zinc-600">{message}</p>
        <p className="mt-2 text-sm font-medium text-[#8a7355]">{email}</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="otp-verification-input" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a7355]">
              OTP
            </label>
            <input
              id="otp-verification-input"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              className="mt-1 w-full rounded-xl border border-[#dcc59b] bg-white/95 px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-[#b07f2e]"
              placeholder="Enter 6-digit OTP"
              maxLength={6}
              value={otp}
              onChange={(event) => {
                setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                setValidationError('')
              }}
            />
          </div>

          {validationError ? <p className="text-sm text-red-600">{validationError}</p> : null}
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-600">{success}</p> : null}

          <div className="space-y-3">
            <Button
              type="submit"
              size="lg"
              className="w-full !border-[#b07f2e] !bg-[#b07f2e] !text-white hover:!bg-[#99661f]"
              disabled={isVerifying || otp.trim().length !== 6}
            >
              {isVerifying ? 'Verifying...' : submitLabel}
            </Button>

            {onResend ? (
              <Button
                type="button"
                size="lg"
                className="w-full border border-[#dcc59b] bg-white text-[#8a7355] hover:border-[#b07f2e] hover:text-[#b07f2e]"
                onClick={() => onResend()}
                disabled={isResending || !canResend}
              >
                {isResending ? 'Sending...' : 'Resend OTP'}
              </Button>
            ) : null}

            <Button
              type="button"
              size="lg"
              className="w-full border border-[#dcc59b] bg-white text-zinc-700 hover:border-[#b07f2e] hover:text-[#b07f2e]"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
