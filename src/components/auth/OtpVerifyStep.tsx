import type { FormEvent, ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { OtpDigitInput } from '@/components/auth/OtpDigitInput'

type OtpVerifyStepProps = {
  /** Prefix for the digit boxes' DOM ids — must be unique per screen. */
  idPrefix: string
  eyebrow: string
  heading: string
  /** The line above the address, e.g. "We sent a verification code to". */
  message: ReactNode
  email: string
  otp: string
  onOtpChange: (next: string) => void
  error?: string | null
  isVerifying?: boolean
  canVerify: boolean
  submitLabel?: string
  onSubmit: (event: FormEvent) => void
  /**
   * Omitted by flows with no resend endpoint — nothing is rendered rather than a button
   * that cannot work.
   */
  resend?: { countdown: number; isSending: boolean; onResend: () => void }
  /** The way back to the previous step, e.g. "Use a different email". */
  backLabel: string
  onBack: () => void
}

/**
 * The "enter your code" step, rendered in the form column of the auth split layout.
 *
 * Shared by the login screen and the registration screen so a customer meets the same
 * panel either way. Registration used to show this as a modal floating over a greyed-out
 * form, which put the same task in a different place depending on how you arrived.
 *
 * Presentation only: it owns no state and makes no requests. The page supplies the code,
 * the handlers and whether a resend is possible.
 */
export function OtpVerifyStep({
  idPrefix,
  eyebrow,
  heading,
  message,
  email,
  otp,
  onOtpChange,
  error,
  isVerifying = false,
  canVerify,
  submitLabel = 'Verify OTP',
  onSubmit,
  resend,
  backLabel,
  onBack,
}: OtpVerifyStepProps) {
  const labelClass = 'text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600'
  const primaryButton = 'w-full !border-black !bg-black !text-white hover:!bg-zinc-800'

  return (
    <div className="pv-auth-rise" key="otp-step">
      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">{eyebrow}</p>
      <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight text-black">{heading}</h1>
      <p className="mt-2 text-sm text-zinc-600">
        {message}
        <br />
        <span className="font-semibold text-black">{email}</span>
      </p>

      <form onSubmit={onSubmit} className="mt-7 space-y-4" noValidate>
        <div>
          <label htmlFor={`${idPrefix}-otp-1`} className={labelClass}>
            OTP
          </label>
          <OtpDigitInput
            idPrefix={idPrefix}
            value={otp}
            onChange={onOtpChange}
            describedBy={`${idPrefix}-otp-status`}
            invalid={Boolean(error)}
            autoFocus
            disabled={isVerifying}
          />
        </div>

        <div id={`${idPrefix}-otp-status`} aria-live="polite" className="min-h-0">
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>

        <Button type="submit" size="lg" className={`${primaryButton} max-w-sm`} disabled={!canVerify}>
          {isVerifying ? 'Verifying...' : submitLabel}
        </Button>

        {resend ? (
          <div className="pt-1 text-center text-sm">
            {resend.countdown > 0 ? (
              <span className="text-zinc-500">Resend OTP in {resend.countdown}s</span>
            ) : (
              <button
                type="button"
                onClick={resend.onResend}
                disabled={resend.isSending}
                className="font-semibold text-black underline underline-offset-4 transition-colors hover:text-zinc-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resend.isSending ? 'Sending...' : 'Resend OTP'}
              </button>
            )}
          </div>
        ) : null}
      </form>

      <button
        type="button"
        onClick={onBack}
        className="mt-6 text-sm text-zinc-500 underline underline-offset-4 transition-colors hover:text-black"
      >
        {backLabel}
      </button>
    </div>
  )
}
