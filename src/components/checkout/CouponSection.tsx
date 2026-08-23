import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { applyCoupon } from '@/api/coupon'
import { formatInr } from '@/lib/format'

export type AppliedCoupon = { code: string; discountAmount: number }

type CouponSectionProps = {
  /** Cart total the coupon is validated against (current post-item-discount subtotal). */
  cartTotal: number
  appliedCoupon: AppliedCoupon | null
  onApplied: (coupon: AppliedCoupon) => void
  onRemoved: () => void
}

export function CouponSection({ cartTotal, appliedCoupon, onApplied, onRemoved }: CouponSectionProps) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleApply = async () => {
    const trimmed = code.trim()
    if (!trimmed || loading) return

    setLoading(true)
    setFeedback(null)

    const result = await applyCoupon(trimmed, cartTotal)

    setLoading(false)

    if (result.ok) {
      onApplied({ code: trimmed, discountAmount: result.discountAmount })
      setFeedback({ type: 'success', message: result.message ?? 'Coupon applied successfully' })
    } else {
      setFeedback({ type: 'error', message: result.message })
    }
  }

  const handleRemove = () => {
    onRemoved()
    setCode('')
    setFeedback(null)
  }

  if (appliedCoupon) {
    return (
      <div>
        <p className="type-label">Coupon</p>
        <div className="mt-2 flex items-center justify-between border border-black px-3.5 py-2.5 dark:border-white">
          <span className="font-sans text-sm font-bold uppercase tracking-wide text-black dark:text-white">
            {appliedCoupon.code}
          </span>
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove coupon"
            className="font-sans text-xs font-semibold uppercase tracking-wide text-zinc-500 transition-colors hover:text-black dark:hover:text-white"
          >
            ✕ Remove
          </button>
        </div>
        <p className="mt-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">✓ Coupon applied successfully</p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
          {formatInr(appliedCoupon.discountAmount)} saved with this coupon
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="type-label">Coupon Code</p>
      <div className="mt-2 flex gap-2">
        <label htmlFor="coupon-code" className="sr-only">
          Coupon code
        </label>
        <input
          id="coupon-code"
          type="text"
          value={code}
          onChange={(e) => {
            setCode(e.target.value)
            setFeedback(null)
          }}
          placeholder="Enter coupon code"
          disabled={loading}
          className="flex-1 border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition-colors focus:border-black disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
        />
        <Button type="button" size="sm" onClick={handleApply} disabled={loading || !code.trim()}>
          {loading ? 'Applying…' : 'Apply'}
        </Button>
      </div>
      {feedback ? (
        <p className="mt-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {feedback.type === 'success' ? '✓ ' : '✕ '}
          {feedback.message}
        </p>
      ) : null}
    </div>
  )
}
