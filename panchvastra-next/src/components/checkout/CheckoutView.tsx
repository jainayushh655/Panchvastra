'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BackendImage } from '@/components/BackendImage'
import { Button } from '@/components/ui/Button'
import { CouponSection, type AppliedCoupon } from '@/components/checkout/CouponSection'
import { usePlaceOrder } from '@/components/checkout/usePlaceOrder'
import { DeliveryAddressSection } from '@/components/checkout/DeliveryAddressSection'
import { useAddresses } from '@/context/AddressProvider'
import { useCart } from '@/context/CartProvider'
import { isLineUnavailable, unavailableLines } from '@/lib/cartAvailability'
import { formatInr } from '@/lib/format'

/**
 * Checkout — the review step.
 *
 * Ported from the Vite `CheckoutPage`. The layout, every class, the order summary's
 * arithmetic, the coupon behaviour, the address selection rules and all of the copy are
 * unchanged.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ORDER PLACEMENT LIVES IN `usePlaceOrder`
 * ──────────────────────────────────────────────────────────────────────────────
 * Both flows — Razorpay and Cash on Delivery — their guards, and the rule about when the
 * cart may be cleared are in that hook, so this file stays presentation. See it for the
 * three verification outcomes, in particular the one the Vite page does not distinguish:
 * a payment whose result could not be established.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHERE THE NUMBERS COME FROM
 * ──────────────────────────────────────────────────────────────────────────────
 * All of them from the cart the backend already returned — nothing is recomputed:
 *
 *   MRP              cart.summary.total_mrp        (pre-discount)
 *   Product discount cart.summary.total_discount   (DISPLAY ONLY, see below)
 *   Subtotal         sum(selling_price x qty)      (ALREADY discounted)
 *   Shipping         0, see the constant
 *   Coupon discount  computed from the coupon record, on the subtotal
 *
 * `totalDiscount` is shown but never subtracted again: the subtotal is built from selling
 * prices, so the product reduction is already inside it. Subtracting it here would
 * double-count it and understate the total.
 */

function IconCard({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <rect x="2.5" y="5" width="19" height="14" rx="2" strokeWidth={1.6} />
      <path d="M2.5 9.5h19" strokeWidth={1.6} />
      <path d="M6 14.5h4" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  )
}

function IconCash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M2.5 7h12v8h-12z" strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx="8.5" cy="11" r="2" strokeWidth={1.6} />
      <path d="M14.5 10h4l3 3v2h-7z" strokeWidth={1.6} strokeLinejoin="round" />
      <circle cx="17.5" cy="17" r="1.6" strokeWidth={1.6} />
      <circle cx="6.5" cy="17" r="1.6" strokeWidth={1.6} />
    </svg>
  )
}

function IconLock({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" strokeWidth={1.8} />
      <path d="M8 10.5V7a4 4 0 118 0v3.5" strokeWidth={1.8} strokeLinecap="round" />
    </svg>
  )
}

/**
 * The two payment routes, with the copy the customer reads for each.
 *
 * `upi` is the Razorpay flow and is labelled "Pay Online" rather than naming an
 * instrument: Razorpay's own sheet offers UPI, cards, netbanking and wallets, and which
 * one gets used is chosen there, not here. The internal value stays `upi` so the submit
 * routing 4E-2B adds is the same routing the Vite page uses.
 */
const PAYMENT_METHODS = [
  {
    value: 'upi' as const,
    title: 'Pay Online',
    caption: 'UPI, Credit/Debit Cards & other supported methods',
    Icon: IconCard,
  },
  {
    value: 'cod' as const,
    title: 'Cash on Delivery',
    caption: 'Pay when your order is delivered',
    Icon: IconCash,
  },
]

export function CheckoutView() {
  const router = useRouter()
  const { items, subtotal, totalDiscount, totalMrp, isLoading, loadError, refreshCart } = useCart()
  const {
    addresses,
    loading: addressesLoading,
    error: addressesError,
    refresh: refreshAddresses,
    addAddress,
    updateAddress,
  } = useAddresses()

  /**
   * Shipping is not being charged at the moment.
   *
   * This was previously decided in the storefront: ₹99 under a ₹1,999 cart and free above
   * it. That was wrong in two ways. The storefront was inventing a commercial charge the
   * backend knows nothing about, and the backend is what actually owns the payable amount
   * — the order endpoints are sent only an `address_id` and an optional `coupon_code` and
   * compute the total themselves — so this number never reached the charge. A customer
   * could be shown a total ₹99 higher than the one Razorpay then asked them to pay.
   *
   * Pinned to 0 until the backend supplies the figure. The order contract already carries
   * `price_summary.shipping_amount`, so that is where the real value will come from; it is
   * one named constant here precisely so switching to it is a one-line change.
   */
  const SHIPPING_CHARGE = 0
  const shipping = SHIPPING_CHARGE

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)

  const [pay, setPay] = useState<'upi' | 'cod'>('upi')

  /*
   * Order placement lives in `usePlaceOrder` — the Razorpay flow, the COD flow, the
   * duplicate-submission guard and the cart-clearing rule. This component keeps only what
   * it draws. The address error is owned by the hook too, since it is set by the same
   * validation that gates the request.
   */
  const {
    placeOrder: submitOrder,
    busy,
    submitError,
    addressError: submitAddressError,
    pendingVerification,
    locked,
  } = usePlaceOrder()

  // Default to the default address, else the first saved one, whenever the currently
  // selected id becomes invalid (initial load, or the selected address was deleted).
  useEffect(() => {
    if (selectedAddressId && addresses.some((a) => a.id === selectedAddressId)) return
    const fallback = addresses.find((a) => a.isDefault) ?? addresses[0]
    setSelectedAddressId(fallback?.id ?? null)
  }, [addresses, selectedAddressId])

  /**
   * Lines that cannot currently be ordered, read from the stock fields the cart response
   * already carries. See `@/lib/cartAvailability` for the rule and for why an ABSENT
   * field is never treated as zero.
   *
   * ⚠️ THIS DOES NOT TOUCH ANY MONEY. The coupon, the shipping line, the product discount
   * and the payable total are computed exactly as before, from exactly the same values.
   * An unavailable line is still counted in the cart totals, because those totals are the
   * backend's and this screen does not get to edit them — the fix is that the order
   * cannot be SUBMITTED while such a line is present, not that the arithmetic changes
   * underneath the customer.
   */
  const blockedLines = unavailableLines(items)
  const hasUnavailableItems = blockedLines.length > 0

  // `subtotal` already reflects the backend's real per-item discount (cart item selling
  // price). `totalDiscount` (cart.summary.total_discount) is shown for transparency only
  // and is NOT subtracted again here — doing so would double-count it.
  const couponDiscount = appliedCoupon?.discountAmount ?? 0
  const total = subtotal + shipping - couponDiscount
  /** What the customer saved overall: product-level reduction plus any coupon. */
  const totalSavings = totalDiscount + couponDiscount

  /**
   * Hands the chosen flow everything it needs, and nothing it does not.
   *
   * The hook re-runs the stock and address checks itself — a disabled button and a
   * pre-checked address are presentation, and the submit path must hold wherever the
   * click came from.
   */
  const placeOrder = () => {
    submitOrder({
      method: pay,
      address: addresses.find((a) => a.id === selectedAddressId),
      couponCode: appliedCoupon?.code ?? null,
    })
  }


  /*
   * THE LOADING AND ERROR STATES ARE ADDITIONS, for the reason recorded in Phase 4C.
   *
   * The Vite page renders "Cart empty." the moment `items` is empty, and its provider has
   * no notion of loading. In this application the session is restored AFTER mount, so a
   * signed-in customer would be told their cart was empty for a moment on every visit —
   * on the one screen where that is most alarming. And a cart that failed to LOAD is not
   * an empty cart either; saying so would send someone back to the shop to re-add items
   * they still have.
   */
  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="type-page-title">Checkout</h1>
        <p className="mt-6 text-sm text-zinc-600" role="status" aria-live="polite">
          Loading your order…
        </p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="type-page-title">Checkout</h1>
        <div className="mt-6 border border-zinc-200 bg-soft-beige p-6 text-center" role="alert">
          <p className="text-sm text-zinc-700">{loadError}</p>
          <Button type="button" className="mt-4" onClick={() => void refreshCart()}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-zinc-600 dark:text-zinc-400">
        Cart empty.{' '}
        <button
          type="button"
          className="font-semibold text-black underline underline-offset-2 dark:text-white"
          onClick={() => router.push('/shop')}
        >
          Shop
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="type-page-title">Checkout</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Review your delivery details and order before placing your order.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <DeliveryAddressSection
            addresses={addresses}
            loading={addressesLoading}
            loadError={addressesError}
            onRetry={refreshAddresses}
            selectedAddressId={selectedAddressId}
            onSelectAddress={setSelectedAddressId}
            onAddAddress={addAddress}
            onUpdateAddress={updateAddress}
            error={submitAddressError}
          />

          <section className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 className="type-section-title">Your Order</h2>
              {/* Quantities and removals stay on the Cart page, which owns them — this is a
                  review step, so it links there rather than duplicating those controls. */}
              <Link
                href="/cart"
                className="inline-flex min-h-[32px] items-center font-sans text-xs font-semibold text-black underline underline-offset-2 dark:text-white"
              >
                Edit cart
              </Link>
            </div>
            {/*
              One notice for the whole section, so the instruction is stated once rather
              than repeated on every affected row. It names the count, says plainly what
              has to happen, and the only action it offers is the one that can fix it.
            */}
            {hasUnavailableItems ? (
              <div
                role="alert"
                className="mt-4 border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40"
              >
                <p className="font-sans text-sm font-bold text-red-700 dark:text-red-300">
                  {blockedLines.length === 1
                    ? '1 item is no longer available'
                    : `${blockedLines.length} items are no longer available`}
                </p>
                <p className="mt-1 font-sans text-sm text-red-700/90 dark:text-red-300/90">
                  Remove {blockedLines.length === 1 ? 'it' : 'them'} from your cart, or change the size or quantity,
                  before placing your order.
                </p>
                <Link
                  href="/cart"
                  className="mt-3 inline-flex min-h-[38px] items-center justify-center bg-chocolate px-5 text-xs font-bold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-espresso"
                >
                  Update cart
                </Link>
              </div>
            ) : null}

            <ul className="mt-5 divide-y divide-zinc-100 dark:divide-zinc-900">
              {items.map((i) => {
                const unavailable = isLineUnavailable(i)
                return (
                <li key={i.key} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  {/* `relative` is the only change: `next/image` with `fill` needs a
                      positioned box, and this one already had the exact 88px square the
                      image is meant to fill.

                      An unavailable line's photograph is dimmed and desaturated, so the
                      row reads as "not part of this order" at a glance — the same signal
                      the size picker uses for a size that cannot be bought. */}
                  <div
                    className={`relative size-[88px] shrink-0 border border-zinc-200 dark:border-zinc-800 ${
                      unavailable ? 'opacity-45 grayscale' : ''
                    }`}
                  >
                    <BackendImage src={i.image} alt="" fill sizes="88px" className="object-cover" />
                  </div>
                  {/* Name, then the variant line, then the price — stacked, so the row reads
                      top-to-bottom instead of splitting the price off to the far edge. */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-sans text-sm font-bold text-black dark:text-white">{i.name}</p>
                      {/* The badge carries the state in words, not only in the dimming —
                          colour alone is not a label, and this is the one row-level fact
                          that changes what the customer has to do next. */}
                      {unavailable ? (
                        <span className="border border-red-300 bg-red-50 px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
                          Unavailable
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 font-sans text-sm text-zinc-500 dark:text-zinc-400">
                      Size: {i.size}
                      {i.color ? ` · ${i.color}` : ''} · Qty: {i.quantity}
                    </p>
                    {/* Per-unit selling price with the MRP struck through — same pattern and
                        same cart data as the Cart page. Order Summary totals are unaffected. */}
                    <p className="mt-2 flex items-baseline gap-2">
                      <span className="font-sans text-sm font-bold text-black dark:text-white">
                        {formatInr(i.price)}
                      </span>
                      {(i.mrp ?? 0) > i.price ? (
                        <span className="text-xs text-zinc-400 line-through">{formatInr(i.mrp ?? 0)}</span>
                      ) : null}
                    </p>
                    {/*
                      The per-row explanation. It says which of the two signals fired, in
                      the customer's terms rather than the API's: a line the backend has
                      flagged out of stock, or one whose remaining stock is gone.
                    */}
                    {unavailable ? (
                      <p className="mt-2 font-sans text-xs font-semibold text-red-700 dark:text-red-300">
                        Out of stock — remove this item or change its size in your cart to continue.
                      </p>
                    ) : null}
                  </div>
                </li>
                )
              })}
            </ul>
          </section>

          {submitError ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
              {submitError}
            </p>
          ) : null}

          {/*
            ⚠️ A PAYMENT WHOSE OUTCOME IS UNKNOWN.
            ──────────────────────────────────────────────────────────────────────
            Deliberately NOT styled or worded as a failure. The customer may well have
            paid: the verification request is what went missing, not necessarily the
            money. So this says pending, gives the order reference to quote, and sends
            them to their orders — where the backend's own `payment_status` is the
            authority — instead of inviting a second attempt.

            It is amber rather than red for the same reason, and the Place Order button
            stays disabled underneath it: paying twice is the one outcome worse than
            waiting.
          */}
          {pendingVerification ? (
            <div
              role="alert"
              aria-live="assertive"
              className="border border-amber-400 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/40"
            >
              <p className="font-sans text-sm font-bold text-amber-900 dark:text-amber-200">
                {pendingVerification.kind === 'payment'
                  ? 'Payment verification is pending'
                  : 'Your order is being confirmed'}
              </p>
              {/* Two different truths. A Razorpay payment may already have taken money, so
                  the warning is about not paying twice. Cash on delivery has taken none —
                  the risk there is a duplicate ORDER — so it must not mention a bank
                  account at all. */}
              <p className="mt-1 font-sans text-sm text-amber-900/90 dark:text-amber-200/90">
                {pendingVerification.kind === 'payment'
                  ? 'We could not reach the server to confirm your payment. If money has left your account, the order may still have gone through — please do not pay again. Check your orders in a few minutes, and contact support with the reference below if it does not appear.'
                  : 'We could not confirm whether your order was placed. It may already have gone through, so please do not order again. Check your orders in a few minutes, and contact support if it does not appear.'}
              </p>
              {pendingVerification.orderId !== null || pendingVerification.razorpayOrderId ? (
                <p className="mt-2 font-sans text-xs text-amber-900/80 dark:text-amber-200/80">
                  Reference:{' '}
                  <span className="font-semibold tabular-nums">
                    {pendingVerification.orderId !== null
                      ? `Order ${pendingVerification.orderId}`
                      : pendingVerification.razorpayOrderId}
                  </span>
                </p>
              ) : null}
              <Link
                href="/orders"
                className="mt-3 inline-flex min-h-[38px] items-center justify-center bg-chocolate px-5 text-xs font-bold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-espresso"
              >
                Check my orders
              </Link>
            </div>
          ) : null}
        </div>

        <aside className="h-fit space-y-6 border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <h2 className="type-section-title">Order Summary</h2>
            {/* MRP = the pre-discount total, Product discount = the product-level reduction,
                Subtotal = the selling-price total (already discounted, so the product
                discount is never subtracted from it again). All from cart data. */}
            <div className="mt-4 text-sm">
              <div className="space-y-2">
                {totalMrp > 0 ? (
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>MRP</span>
                    <span>{formatInr(totalMrp)}</span>
                  </div>
                ) : null}
                {totalDiscount > 0 ? (
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>Product discount</span>
                    <span>-{formatInr(totalDiscount)}</span>
                  </div>
                ) : null}
              </div>

              {/* Subtotal and Shipping sit in their own group, so the eye reads "what the
                  items cost" separately from "what was knocked off the sticker price". */}
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Subtotal</span>
                  <span>{formatInr(subtotal)}</span>
                </div>
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? 'Free' : formatInr(shipping)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <CouponSection
              cartTotal={subtotal}
              appliedCoupon={appliedCoupon}
              onApplied={setAppliedCoupon}
              onRemoved={() => setAppliedCoupon(null)}
            />
          </div>

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-800">
            {/* The coupon reduction stays separate from the product-level Discount above. */}
            {couponDiscount > 0 ? (
              <div className="mb-2 flex justify-between text-sm text-zinc-600 dark:text-zinc-400">
                <span>Coupon Discount</span>
                <span>-{formatInr(couponDiscount)}</span>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between gap-3 text-xl font-bold text-zinc-900 dark:text-white">
              <span>Total</span>
              <span>{formatInr(total)}</span>
            </div>
            {/* Everything actually knocked off: the product-level reduction plus any coupon.
                Shown only when there is a saving, so it never reads "You save ₹0". */}
            {totalSavings > 0 ? (
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                You save {formatInr(totalSavings)} on this order.
              </p>
            ) : null}
          </div>

          <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <p className="type-label">Payment Method</p>
            <div className="mt-3 space-y-2">
              {PAYMENT_METHODS.map((method) => {
                const selected = pay === method.value
                return (
                  <label
                    key={method.value}
                    // The selected option carries a darker border, so the choice is legible
                    // without relying on the radio dot alone.
                    className={`flex cursor-pointer items-center gap-3 border p-3 transition-colors ${
                      selected
                        ? 'border-zinc-900 dark:border-zinc-100'
                        : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="pay"
                      checked={selected}
                      onChange={() => setPay(method.value)}
                      className="size-4 shrink-0 accent-black"
                    />
                    <method.Icon className="size-5 shrink-0 text-zinc-500 dark:text-zinc-400" />
                    <span className="min-w-0">
                      <span className="block font-sans text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {method.title}
                      </span>
                      <span className="mt-0.5 block font-sans text-xs text-zinc-500 dark:text-zinc-400">
                        {method.caption}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div>
            {/* The amount is repeated on the button so the number being committed to is the
                last thing read before the click.

                Disabled while any line is unavailable. The label is left alone — the
                reason is stated in the order list and again directly below, where a
                disabled control is explained rather than just dead. */}
            <Button
              size="lg"
              type="button"
              onClick={placeOrder}
              /*
               * Disabled for three different reasons: an unavailable line, a request
               * already in flight, and a payment whose outcome is unknown. The last one
               * never releases on its own — see `usePlaceOrder`.
               */
              disabled={hasUnavailableItems || busy || locked}
              aria-busy={busy}
              aria-describedby={hasUnavailableItems ? 'checkout-blocked-reason' : undefined}
              className="w-full"
            >
              {busy ? 'Saving…' : `Place Order · ${formatInr(total)}`}
            </Button>

            {hasUnavailableItems ? (
              <p
                id="checkout-blocked-reason"
                className="mt-3 text-center font-sans text-xs font-semibold text-red-700 dark:text-red-300"
              >
                Update your cart to continue —{' '}
                <Link href="/cart" className="underline underline-offset-2">
                  go to cart
                </Link>
              </p>
            ) : null}

            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
              <IconLock className="size-3.5 shrink-0" />
              Secure checkout <span aria-hidden>·</span> Easy returns
            </p>
          </div>

          <p className="border-t border-zinc-200 pt-5 text-center text-[11px] text-zinc-500 dark:border-zinc-800">
            Need help with your order?{' '}
            <Link href="/help-desk" className="font-semibold text-black underline underline-offset-2 dark:text-white">
              Help Desk
            </Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
