import { useEffect, useRef } from 'react'

/**
 * Matches the text inputs on the auth screens, so a box here sits on the same visual
 * grid as the email field above it.
 */
const BOX_CLASS =
  'border border-zinc-300 bg-white text-sm text-zinc-900 outline-none transition-colors focus:border-black focus:ring-2 focus:ring-black/10 h-12 min-w-0 flex-1 px-1 text-center text-lg font-semibold'

type OtpDigitInputProps = {
  /** Prefix for each box's DOM id — must be unique per screen. */
  idPrefix: string
  /** The code so far, 0-6 digits. The parent owns it. */
  value: string
  onChange: (next: string) => void
  /** Id of the live region announcing errors, wired to each box. */
  describedBy?: string
  invalid?: boolean
  /** Focus the first box on mount — used when the step appears. */
  autoFocus?: boolean
  disabled?: boolean
}

/**
 * The six-box OTP entry used by every screen that asks for a code.
 *
 * This was previously written inline on the login screen only, which is why the
 * registration modal had drifted to a single plain text field — the same code entry
 * looked and behaved differently depending on how you arrived at it. Keeping one
 * component means a fix to the typing behaviour lands everywhere at once.
 *
 * Behaviour: digits only, one per box, focus advances as you type and steps back on
 * Backspace from an empty box, and pasting a code fills the row and lands focus on the
 * last filled box.
 */
export function OtpDigitInput({
  idPrefix,
  value,
  onChange,
  describedBy,
  invalid,
  autoFocus,
  disabled,
}: OtpDigitInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus()
  }, [autoFocus])

  return (
    <div className="mt-1 flex max-w-sm gap-2" role="group" aria-label="6-digit OTP">
      {Array.from({ length: 6 }, (_, index) => (
        <input
          key={index}
          id={`${idPrefix}-otp-${index + 1}`}
          ref={(element) => {
            refs.current[index] = element
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          disabled={disabled}
          value={value[index] ?? ''}
          onChange={(event) => {
            const digit = event.target.value.replace(/\D/g, '').slice(-1)
            const next = value.slice(0, index) + digit + value.slice(index + 1)
            onChange(next.slice(0, 6))
            if (digit && index < 5) refs.current[index + 1]?.focus()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !value[index] && index > 0) {
              refs.current[index - 1]?.focus()
            }
          }}
          onPaste={(event) => {
            event.preventDefault()
            const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
            if (!pasted) return
            onChange(pasted)
            refs.current[Math.min(pasted.length, 6) - 1]?.focus()
          }}
          aria-label={`OTP digit ${index + 1}`}
          aria-describedby={describedBy}
          aria-invalid={invalid ? true : undefined}
          className={BOX_CLASS}
        />
      ))}
    </div>
  )
}
