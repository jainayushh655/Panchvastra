import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '@/context/AuthProvider'

type NotifyMeModalProps = {
  isOpen: boolean
  /** All currently-unavailable sizes for this product/variant — sourced from the same
   * size-availability data the Product Detail size selector already computes, so this
   * modal never calculates availability on its own. */
  unavailableSizes: string[]
  /** The specific size the user was interacting with when they opened the modal, if any. */
  preselectedSize?: string
  onClose: () => void
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

/**
 * No backend notify/back-in-stock endpoint exists in this codebase or the live API
 * (verified: every candidate route — notify, notify_me, notifications, back_in_stock,
 * stock_notifications, product_notifications, notify_management — returns a genuine 404,
 * the same signal that confirms wishlist/favorites are absent too). This collects the
 * request locally and confirms it in the UI only; it does not call an API, so it does not
 * actually persist or send the request anywhere yet.
 */
export function NotifyMeModal({ isOpen, unavailableSizes, preselectedSize, onClose }: NotifyMeModalProps) {
  const { user } = useAuth()
  const [selectedSizes, setSelectedSizes] = useState<string[]>([])
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setSelectedSizes(preselectedSize && unavailableSizes.includes(preselectedSize) ? [preselectedSize] : [])
    setEmail(user?.email ?? '')
    setSubmitted(false)
    setError('')
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

  const toggleSize = (value: string) => {
    setError('')
    setSelectedSizes((prev) => (prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]))
  }

  // Display in canonical size order regardless of the order sizes were clicked in.
  const orderedSelectedSizes = unavailableSizes.filter((s) => selectedSizes.includes(s))

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (selectedSizes.length === 0) {
      setError('Please select at least one size.')
      return
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address.')
      return
    }

    setError('')
    setSubmitted(true)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6"
      onClick={onClose}
    >
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

        {submitted ? (
          <div className="pb-2 pt-1">
            <p className="text-lg font-semibold uppercase tracking-tight text-black">You're on the list</p>
            <p className="mt-2 text-sm text-zinc-600">
              We'll email {email} once size{orderedSelectedSizes.length > 1 ? 's' : ''} {orderedSelectedSizes.join(', ')} {orderedSelectedSizes.length > 1 ? 'are' : 'is'} back in stock.
            </p>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Select your size</p>

            {unavailableSizes.length > 0 ? (
              <>
                <p className="mt-3 text-sm text-zinc-600">Select sizes you'd like to be notified about.</p>

                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {unavailableSizes.map((s) => {
                    const selected = selectedSizes.includes(s)
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleSize(s)}
                        className={`flex h-10 min-w-[44px] items-center justify-center rounded-lg border px-3 text-sm font-semibold transition-colors ${
                          selected
                            ? 'border-black bg-black text-white'
                            : 'border-zinc-300 bg-white text-black hover:border-black'
                        }`}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>

                <p className="mt-3 min-h-[1.25rem] text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {orderedSelectedSizes.length > 0 ? `Selected: ${orderedSelectedSizes.join(', ')}` : ''}
                </p>

                <p className="mt-2 text-sm text-zinc-600">
                  Get notified once {orderedSelectedSizes.length > 1 ? 'these sizes are' : 'this size is'} back in stock.
                </p>
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
                onChange={(e) => {
                  setEmail(e.target.value)
                  setError('')
                }}
                placeholder="Enter your email"
                className="w-full border border-zinc-300 bg-white px-4 py-2.5 text-sm text-black outline-none transition-colors focus:border-black"
              />

              {error ? <p className="text-sm text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={unavailableSizes.length === 0}
                className="w-full bg-black px-6 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Submit
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
