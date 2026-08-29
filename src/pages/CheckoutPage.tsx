import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CouponSection, type AppliedCoupon } from '@/components/checkout/CouponSection'
import { DeliveryAddressSection } from '@/components/checkout/DeliveryAddressSection'
import {
  createCodOrder,
  createPaymentOrder,
  loadRazorpayScript,
  readPaymentApiError,
  verifyPayment,
} from '@/api/payment'
import { useAddresses } from '@/context/AddressProvider'
import { useCart } from '@/context/CartProvider'
import { formatInr } from '@/lib/format'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuth } from '@/context/AuthProvider'
import { Link, useNavigate } from 'react-router-dom'

export function CheckoutPage() {
  useDocumentTitle('Checkout')
  const navigate = useNavigate()
  const { items, subtotal, totalDiscount, totalMrp, clear } = useCart()
  const { user } = useAuth()
  const {
    addresses,
    loading: addressesLoading,
    error: addressesError,
    refresh: refreshAddresses,
    addAddress,
    updateAddress,
  } = useAddresses()

  // Existing calculation, unchanged.
  const shipping = subtotal > 0 ? (subtotal >= 1999 ? 0 : 99) : 0

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null)

  const [pay, setPay] = useState<'upi' | 'cod'>('upi')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  /** Synchronous guard so a double click cannot create two Razorpay orders. */
  const paymentInFlight = useRef(false)

  // Default to the default address, else the first saved one, whenever the currently
  // selected id becomes invalid (initial load, or the selected address was deleted).
  useEffect(() => {
    if (selectedAddressId && addresses.some((a) => a.id === selectedAddressId)) return
    const fallback = addresses.find((a) => a.isDefault) ?? addresses[0]
    setSelectedAddressId(fallback?.id ?? null)
  }, [addresses, selectedAddressId])

  // `subtotal` already reflects the backend's real per-item discount (cart item selling
  // price). `totalDiscount` (cart.summary.total_discount) is shown for transparency only
  // and is NOT subtracted again here — doing so would double-count it.
  const couponDiscount = appliedCoupon?.discountAmount ?? 0
  const total = subtotal + shipping - couponDiscount

  /**
   * Online payment (UPI / Cards) via Razorpay.
   *
   * The backend owns the payable amount and the order: this never derives an amount from
   * cart totals, and the payment only counts as successful once
   * POST /v1/verify_payment_api/ confirms the signature. Independent of WhatsApp config.
   */
  const payWithRazorpay = async () => {
    if (!items.length || paymentInFlight.current) return

    const selectedAddress = addresses.find((a) => a.id === selectedAddressId)
    if (!selectedAddress) {
      setAddressError('Please select a delivery address before placing your order.')
      return
    }

    const addressId = Number(selectedAddress.id)
    if (!Number.isFinite(addressId)) {
      setAddressError('Please select a delivery address before placing your order.')
      return
    }

    setAddressError(null)
    setSubmitError(null)
    paymentInFlight.current = true
    setBusy(true)

    let paymentOrder: Awaited<ReturnType<typeof createPaymentOrder>>
    try {
      // Only send coupon_code when one is actually applied.
      paymentOrder = await createPaymentOrder({
        address_id: addressId,
        ...(appliedCoupon?.code ? { coupon_code: appliedCoupon.code } : {}),
      })
    } catch (err) {
      setSubmitError(readPaymentApiError(err, 'Unable to start payment. Please try again.'))
      paymentInFlight.current = false
      setBusy(false)
      return
    }

    if (!paymentOrder?.razorpay_order_id || !paymentOrder.key) {
      setSubmitError('Unable to start payment. Please try again.')
      paymentInFlight.current = false
      setBusy(false)
      return
    }

    const loaded = await loadRazorpayScript()
    if (!loaded || !window.Razorpay) {
      setSubmitError('Could not load the payment gateway. Please check your connection and try again.')
      paymentInFlight.current = false
      setBusy(false)
      return
    }

    /** Releases the submit guard so the customer can retry after any failure. */
    const release = () => {
      paymentInFlight.current = false
      setBusy(false)
    }

    // Razorpay can fire `handler` more than once for a single payment (duplicate or
    // replayed callbacks). One payment must produce exactly one verification, so the first
    // invocation claims this attempt and any repeat is ignored. Scoped to this attempt, so
    // a real retry — which creates a new Razorpay order — still verifies normally.
    let verificationStarted = false

    const checkout = new window.Razorpay({
      // Every value below comes from the backend response, verbatim. `amount` is already
      // in paise and is NOT recomputed or multiplied here.
      key: paymentOrder.key,
      amount: paymentOrder.amount,
      currency: paymentOrder.currency,
      order_id: paymentOrder.razorpay_order_id,
      name: 'Panchvastra',
      description: `Order ${paymentOrder.order_id}`,
      prefill: {
        name: selectedAddress.fullName,
        email: user?.email ?? '',
        contact: selectedAddress.phone,
      },
      theme: { color: '#000000' },
      modal: {
        // Customer closed the sheet: nothing is paid, the cart stays, retry is allowed.
        ondismiss: () => {
          setSubmitError('Payment was cancelled. Your cart has been saved.')
          release()
        },
      },
      handler: async (response) => {
        if (verificationStarted) return
        verificationStarted = true

        try {
          const verified = await verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          })

          if (!verified?.success) {
            setSubmitError(
              verified?.message || "We couldn't verify your payment. Please try again or contact support.",
            )
            release()
            return
          }
        } catch (err) {
          setSubmitError(
            readPaymentApiError(err, "We couldn't verify your payment. Please try again or contact support."),
          )
          release()
          return
        }

        // Verified by the backend — only now is the order paid.
        clear()
        release()
        navigate('/orders', { replace: true })
      },
    })

    checkout.on?.('payment.failed', () => {
      setSubmitError('Your payment could not be completed. Please try again.')
      release()
    })

    checkout.open()
  }

  /**
   * Cash on delivery via the dedicated backend endpoint, POST /v1/cod_order/.
   *
   * Entirely separate from the Razorpay flow: it never calls /v1/checkout_payment/ or
   * /v1/verify_payment_api/, never loads or opens the Razorpay SDK, and no longer hands the
   * customer off to WhatsApp. The backend creates the order and owns subtotal / discount /
   * grand_total, so no amount is derived from cart values here.
   *
   * Reuses the existing `paymentInFlight` guard, so one user action can only ever produce
   * one POST no matter how many times Place Order is clicked.
   */
  const submitCod = async () => {
    if (!items.length || paymentInFlight.current) return

    const selectedAddress = addresses.find((a) => a.id === selectedAddressId)
    if (!selectedAddress) {
      setAddressError('Please select a delivery address before placing your order.')
      return
    }

    const addressId = Number(selectedAddress.id)
    if (!Number.isFinite(addressId)) {
      setAddressError('Please select a delivery address before placing your order.')
      return
    }

    setAddressError(null)
    setSubmitError(null)
    paymentInFlight.current = true
    setBusy(true)

    /** Releases the submit guard so the customer can retry after any failure. */
    const release = () => {
      paymentInFlight.current = false
      setBusy(false)
    }

    let codOrder: Awaited<ReturnType<typeof createCodOrder>>
    try {
      // Only send coupon_code when a coupon is actually applied.
      codOrder = await createCodOrder({
        address_id: addressId,
        ...(appliedCoupon?.code ? { coupon_code: appliedCoupon.code } : {}),
      })
    } catch (err) {
      setSubmitError(readPaymentApiError(err, 'Could not place your order. Please try again.'))
      release()
      return
    }

    // Only an explicit success from the backend counts as a placed order.
    if (!codOrder?.success || !codOrder.data?.order_id) {
      setSubmitError(codOrder?.message || 'Could not place your order. Please try again.')
      release()
      return
    }

    // The backend has created the order — only now is the cart cleared.
    clear()
    release()
    navigate('/orders', { replace: true })
  }

  /** Routes Place Order to the flow the customer actually chose. */
  const submit = () => (pay === 'cod' ? submitCod() : payWithRazorpay())

  if (!items.length) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-zinc-600 dark:text-zinc-400">
        Cart empty.{' '}
        <button
          type="button"
          className="font-semibold text-black underline underline-offset-2 dark:text-white"
          onClick={() => navigate('/shop')}
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
        Review your delivery address and order, then choose your preferred payment method.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
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
            error={addressError}
          />

          <section className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="type-section-title">Your Order</h2>
            <ul className="mt-5 divide-y divide-zinc-100 dark:divide-zinc-900">
              {items.map((i) => (
                <li key={i.key} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <img
                    src={i.image}
                    alt=""
                    className="h-20 w-16 shrink-0 border border-zinc-200 object-cover dark:border-zinc-800"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-sans text-sm font-semibold text-black dark:text-white">{i.name}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      Size {i.size}
                      {i.color ? ` · ${i.color}` : ''} · Qty {i.quantity}
                    </p>
                  </div>
                  {/* Per-unit selling price with the MRP struck through — same pattern and
                      same cart data as the Cart page. Order Summary totals are unaffected. */}
                  <p className="flex shrink-0 items-baseline gap-2">
                    <span className="font-sans text-sm font-semibold text-black dark:text-white">
                      {formatInr(i.price)}
                    </span>
                    {(i.mrp ?? 0) > i.price ? (
                      <span className="text-xs text-zinc-400 line-through">{formatInr(i.mrp ?? 0)}</span>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          </section>

          {submitError ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
              {submitError}
            </p>
          ) : null}
        </div>

        <aside className="h-fit space-y-6 border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <h2 className="type-section-title">Order Summary</h2>
            <div className="mt-4 space-y-2 text-sm">
              {/* Total Price = the pre-discount MRP total, Discount = the product-level
                  reduction, Subtotal = the selling-price total (already discounted, so the
                  product Discount is never subtracted from it again). All from cart data. */}
              {totalMrp > 0 ? (
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Total Price</span>
                  <span>{formatInr(totalMrp)}</span>
                </div>
              ) : null}
              {totalDiscount > 0 ? (
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Discount</span>
                  <span>-{formatInr(totalDiscount)}</span>
                </div>
              ) : null}
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
            <div className="flex justify-between text-lg font-bold text-zinc-900 dark:text-white">
              <span>Total</span>
              <span>{formatInr(total)}</span>
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <p className="type-label">Payment</p>
            <div className="mt-3 space-y-2">
              <label className="flex cursor-pointer items-center gap-3 border border-zinc-200 p-3 dark:border-zinc-800">
                <input
                  type="radio"
                  name="pay"
                  checked={pay === 'upi'}
                  onChange={() => setPay('upi')}
                  className="accent-black"
                />
                <span className="text-sm text-zinc-800 dark:text-zinc-100">UPI / Cards</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 border border-zinc-200 p-3 dark:border-zinc-800">
                <input
                  type="radio"
                  name="pay"
                  checked={pay === 'cod'}
                  onChange={() => setPay('cod')}
                  className="accent-black"
                />
                <span className="text-sm text-zinc-800 dark:text-zinc-100">Cash on delivery</span>
              </label>
            </div>
            <p className="mt-2 text-[11px] text-zinc-500">
              Choose your preferred payment method to complete your order.
            </p>
          </div>

          <Button size="lg" type="button" onClick={submit} disabled={busy} className="w-full">
            {busy ? 'Saving…' : 'Place Order'}
          </Button>

          <p className="text-[11px] text-zinc-500">
            Need help first?{' '}
            <Link to="/contact" className="font-semibold text-black underline underline-offset-2 dark:text-white">
              Contact
            </Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
