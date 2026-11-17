import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { evaluateCoupon, lookupCouponByCode } from '@/api/coupon'
import { formatInr } from '@/lib/format'
import type { CouponDto } from '@/types/api/CouponDto'

export type AppliedCoupon = {
  code: string
  /** Additional discount from this coupon, on top of the product-level discount. */
  discountAmount: number
  /** The coupon record the backend returned for this code, kept as the source of the discount. */
  coupon?: CouponDto
}

type CouponSectionProps = {
  /**
   * Order amount the coupon applies to — the subtotal AFTER product-level discounts.
   * The coupon reduces this further; the product discount is never recomputed here.
   */
  cartTotal: number
  appliedCoupon: AppliedCoupon | null
  onApplied: (coupon: AppliedCoupon) => void
  onRemoved: () => void
}

export function CouponSection({ cartTotal, appliedCoupon, onApplied, onRemoved }: CouponSectionProps) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Synchronous guard — state updates are not immediate, so a double click could double-request. */
  const inFlight = useRef(false)

  const handleApply = async () => {
    const trimmed = code.trim()
    if (!trimmed || inFlight.current) return

    inFlight.current = true
    setLoading(true)
    setError(null)

    const result = await lookupCouponByCode(trimmed)

    inFlight.current = false
    setLoading(false)

    // Any failure leaves the order untouched: the product discount, the subtotal, an
    // already-applied coupon and the total all stay exactly as they were.
    if (!result.ok) {
      setError(result.message)
      return
    }

    const evaluation = evaluateCoupon(result.coupon, cartTotal)
    if (!evaluation.ok) {
      setError(evaluation.message)
      return
    }

    onApplied({
      code: (result.coupon.code ?? trimmed).toUpperCase(),
      discountAmount: evaluation.discountAmount,
      coupon: result.coupon,
    })
    setCode('')
    setError(null)
  }

  const handleRemove = () => {
    onRemoved()
    setCode('')
    setError(null)
  }

  return (
    <div>
      <p className="type-label">{appliedCoupon ? 'Coupon' : 'Coupon Code'}</p>

      {appliedCoupon ? (
        <>
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
          {/*
            Only the saving is shown once the coupon is on. Its terms — the minimum spend,
            the percentage, the cap — describe whether the code COULD be used, which is
            settled the moment it is applied; restating them next to a discount that is
            already in the total just invites a re-reading of arithmetic the shopper can
            see on the Coupon Discount line below.
          */}
          <p className="mt-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            ✓ {formatInr(appliedCoupon.discountAmount)} extra off with this coupon
          </p>
        </>
      ) : null}

      {/*
        One coupon at a time. Once a code is applied the entry row is removed outright
        rather than re-offered as "try another code": only one coupon can be held anyway
        (the checkout keeps a single applied coupon, not a list), so leaving the field
        there invited an action that would silently replace the discount already showing
        in the total. Swapping codes now goes through Remove, which makes the replacement
        explicit.
      */}
      {appliedCoupon ? null : (
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
              setError(null)
            }}
            placeholder="Enter coupon code"
            disabled={loading}
            className="flex-1 border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition-colors focus:border-black disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
          />
          <Button type="button" size="sm" onClick={handleApply} disabled={loading || !code.trim()}>
            {loading ? 'Applying…' : 'Apply'}
          </Button>
        </div>
      )}

      {error ? (
        <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400" role="alert">
          ✕ {error}
        </p>
      ) : null}
    </div>
  )
}
