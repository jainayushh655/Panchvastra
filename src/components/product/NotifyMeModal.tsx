import { useEffect, useRef, useState, type FormEvent } from 'react'
import { createNotifySubscription, readNotifyApiError } from '@/api/notifyMe'
import { useAuth } from '@/context/AuthProvider'

/** An unavailable size the user can actually subscribe to — it has a real backend id. */
export type NotifyMeSize = {
  size: string
  /** The backend's `VariantSizeDto.id`, sent verbatim as `variant_size_id`. */
  variantSizeId: number
}

type NotifyMeModalProps = {
  isOpen: boolean
  /** Currently-unavailable sizes for this product/variant, derived by the Product Detail
   * page from the same per-variant API data its size selector uses — this modal never
   * computes availability itself. */
  unavailableSizes: NotifyMeSize[]
  /** The specific size the user was interacting with when they opened the modal, if any. */
  preselectedSize?: string
  onClose: () => void
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

/**
 * Restock notification signup, backed by the real POST /v1/notify_me/.
 *
 * Exactly ONE size may be selected per submission — the selection is a single
 * `variant_size_id`, not a list — so one user action creates one subscription.
 */
export function NotifyMeModal({ isOpen, unavailableSizes, preselectedSize, onClose }: NotifyMeModalProps) {
  const { user } = useAuth()
  /** Single selected size. Never an array — one submission subscribes to one size. */
  const [selectedVariantSizeId, setSelectedVariantSizeId] = useState<number | null>(null)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submittedSize, setSubmittedSize] = useState<string | null>(null)
  const [error, setError] = useState('')
  /** Synchronous guard — state updates are not immediate, so a double click could double-post. */
  const inFlight = useRef(false)

  useEffect(() => {
    if (!isOpen) return
    const preselected = preselectedSize
      ? unavailableSizes.find((option) => option.size === preselectedSize)
      : undefined
    setSelectedVariantSizeId(preselected?.variantSizeId ?? null)
    setEmail(user?.email ?? '')
    setSubmittedSize(null)
    setSubmitting(false)
    setError('')
    inFlight.current = false
    // Reset only when the modal transitions open — not on every prop change while it's
    // already open, so the user's in-progress selection isn't wiped by unrelated re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  /** Radio-style: selecting a size replaces any previous selection. */
  const selectSize = (variantSizeId: number) => {
    setError('')
    setSelectedVariantSizeId(variantSizeId)
  }

  const selectedSize = unavailableSizes.find((option) => option.variantSizeId === selectedVariantSizeId)

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return

    if (selectedVariantSizeId === null || !selectedSize) {
      setError('Please select your size.')
      return
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }

    inFlight.current = true
    setSubmitting(true)
    setError('')

    try {
      await createNotifySubscription(selectedVariantSizeId, email)
      setSubmittedSize(selectedSize.size)
    } catch (err) {
      setError(readNotifyApiError(err, 'Could not sign you up right now. Please try again.'))
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Notify me"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm border border-zinc-200 bg-white p-6 text-center shadow-[0_30px_60px_-36px_rgba(0,0,0,0.3)]"
      >
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition-colors hover:border-black hover:text-black"
          >
            ✕
          </button>
        </div>

        {submittedSize ? (
          <div className="pb-2 pt-1">
            <p className="text-lg font-semibold uppercase tracking-tight text-black">You're on the list</p>
            <p className="mt-2 text-sm text-zinc-600">
              We'll email {email} once size {submittedSize} is back in stock.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Select your size</p>

            {unavailableSizes.length > 0 ? (
              <>
                <p className="mt-3 text-sm text-zinc-600">Select the size you'd like to be notified about.</p>

                <div className="mt-4 flex flex-wrap justify-center gap-2" role="radiogroup" aria-label="Select your size">
                  {unavailableSizes.map((option) => {
                    const selected = option.variantSizeId === selectedVariantSizeId
                    return (
                      <button
                        key={option.variantSizeId}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={submitting}
                        onClick={() => selectSize(option.variantSizeId)}
                        className={`flex h-10 min-w-[44px] items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors ${
                          selected
                            ? 'border-black bg-black text-white'
                            : 'border-zinc-300 bg-white text-black hover:border-black'
                        }`}
                      >
                        {option.size}
                      </button>
                    )
                  })}
                </div>

                <p className="mt-3 min-h-[1.25rem] text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {selectedSize ? `Selected: ${selectedSize.size}` : ''}
                </p>

                <p className="mt-2 text-sm text-zinc-600">Get notified once this size is back in stock.</p>
              </>
            ) : (
              <p className="mt-3 text-sm text-zinc-600">All sizes are currently in stock.</p>
            )}

            <form className="mt-5 space-y-3 text-left" onSubmit={handleSubmit} noValidate>
              <label htmlFor="notify-me-email" className="sr-only">
                Email
              </label>
              <input
                id="notify-me-email"
                type="email"
                required
                value={email}
                disabled={submitting}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                placeholder="Enter your email"
                className="w-full border border-zinc-300 bg-white px-4 py-2.5 text-sm text-black outline-none transition-colors focus:border-black"
              />

              {error ? (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={unavailableSizes.length === 0 || submitting}
                className="w-full bg-black px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
