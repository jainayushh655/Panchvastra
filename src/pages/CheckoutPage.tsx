import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { CouponSection, type AppliedCoupon } from '@/components/checkout/CouponSection'
import { DeliveryAddressSection } from '@/components/checkout/DeliveryAddressSection'
import { removeCartItem } from '@/api/cart'
import {
  createCodOrder,
  createPaymentOrder,
  isBuyNowUnavailable,
  loadRazorpayScript,
  readInsufficientStock,
  readPaymentApiError,
  readUnavailableItems,
  verifyPayment,
} from '@/api/payment'
import { useAddresses } from '@/context/AddressProvider'
import { useCart } from '@/context/CartProvider'
import { formatInr } from '@/lib/format'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useAuth } from '@/context/AuthProvider'
import {
  BUY_NOW_PARAM,
  BUY_NOW_VALUE,
  bestTierForQuantity,
  clearBuyNowIntent,
  readBuyNowIntent,
  type BuyNowIntent,
} from '@/lib/buyNow'
import type { InsufficientStockDto, UnavailableItemDto } from '@/types/api/PaymentDto'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

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
 * one gets used is chosen there, not here. The internal value stays `upi` so the existing
 * submit routing is untouched.
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

export function CheckoutPage() {
  useDocumentTitle('Checkout')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const {
    items: cartItems,
    subtotal: cartSubtotal,
    totalDiscount: cartTotalDiscount,
    totalMrp: cartTotalMrp,
    quantityDiscount: cartQuantityDiscount,
    appliedQuantityTier: cartQuantityTier,
    clear,
    refreshCart,
  } = useCart()
  const { user } = useAuth()

  /**
   * Buy Now mode.
   *
   * Selected by a URL parameter AND a stashed intent — both are required. The parameter
   * alone would leave a refreshed page in Buy Now mode with nothing to buy; the intent
   * alone would hijack an ordinary cart checkout with a leftover from an abandoned
   * attempt. Read once on mount: it must not change underneath an in-flight order.
   */
  const [buyNow] = useState<BuyNowIntent | null>(() =>
    searchParams.get(BUY_NOW_PARAM) === BUY_NOW_VALUE ? readBuyNowIntent() : null,
  )
  const isBuyNow = buyNow !== null

  /**
   * A stale intent is cleared the moment this page decides it is NOT in Buy Now mode, so
   * an abandoned attempt can never attach itself to the next ordinary cart checkout.
   */
  useEffect(() => {
    if (!isBuyNow) clearBuyNowIntent()
  }, [isBuyNow])

  /**
   * The lines the summary shows: the whole cart, or the single Buy Now item.
   *
   * Shaped like a cart line so the existing list markup renders both without branching.
   * `cartItemId` is -1 for the Buy Now line because it is not in the cart and has no such
   * id — nothing reads it in this mode.
   */
  const items = useMemo(() => {
    if (!buyNow) return cartItems
    return [
      {
        key: `buy-now-${buyNow.variantSizeId}`,
        cartItemId: -1,
        productId: String(buyNow.productId),
        slug: String(buyNow.productId),
        name: buyNow.name,
        image: buyNow.image,
        price: buyNow.unitPrice,
        mrp: buyNow.mrp,
        quantity: buyNow.quantity,
        size: buyNow.size,
        color: buyNow.color,
        availableStock: buyNow.quantity,
        isInStock: true,
      },
    ]
  }, [buyNow, cartItems])

  /**
   * PREVIEW totals for Buy Now.
   *
   * The backend owns every real figure — it computes the subtotal, the quantity offer and
   * the coupon, and the amounts shown after the order is created come from its response.
   * These exist only so the shopper is not asked to commit to a number they have never
   * seen, and so a quantity offer they have already earned does not appear for the first
   * time on the confirmation.
   */
  const buyNowTotals = useMemo(() => {
    if (!buyNow) return null

    const gross = buyNow.unitPrice * buyNow.quantity
    const mrpTotal = (buyNow.mrp || buyNow.unitPrice) * buyNow.quantity
    const tier = bestTierForQuantity(buyNow.tiers, buyNow.quantity)
    const quantityDiscount = tier ? Math.round(gross * (tier.discount_percentage / 100) * 100) / 100 : 0

    return {
      subtotal: gross,
      totalMrp: mrpTotal,
      productDiscount: Math.max(0, mrpTotal - gross),
      quantityDiscount,
      tier,
    }
  }, [buyNow])

  const subtotal = isBuyNow ? (buyNowTotals?.subtotal ?? 0) : cartSubtotal
  const totalMrp = isBuyNow ? (buyNowTotals?.totalMrp ?? 0) : cartTotalMrp
  const totalDiscount = isBuyNow ? (buyNowTotals?.productDiscount ?? 0) : cartTotalDiscount
  const quantityDiscount = isBuyNow ? (buyNowTotals?.quantityDiscount ?? 0) : cartQuantityDiscount
  const quantityTier = isBuyNow ? (buyNowTotals?.tier ?? null) : cartQuantityTier

  /** Items the backend refused, surfaced so the shopper can clear the blockage. */
  const [unavailableItems, setUnavailableItems] = useState<UnavailableItemDto[]>([])
  const [insufficientStock, setInsufficientStock] = useState<InsufficientStockDto[]>([])
  const [removingItemId, setRemovingItemId] = useState<number | null>(null)
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
   * This was previously decided here, in the storefront: ₹99 under a ₹1,999 cart and free
   * above it. That was wrong in two ways. The storefront was inventing a commercial charge
   * the backend knows nothing about, and the backend is what actually owns the payable
   * amount — `createPaymentOrder` / `createCodOrder` are sent only an `address_id` and an
   * optional `coupon_code`, and compute the total themselves — so this number never
   * reached the charge. A customer could be shown a total ₹99 higher than the one Razorpay
   * then asked them to pay.
   *
   * Pinned to 0 until the backend supplies the figure. The order contract already carries
   * `price_summary.shipping_amount`, so that is where the real value will come from; it is
   * one named constant here precisely so switching to it is a one-line change.
   */
  const SHIPPING_CHARGE = 0
  const shipping = SHIPPING_CHARGE

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

  /**
   * The quantity offer is applied BEFORE the coupon — that ordering is the backend's, and
   * it matters: a coupon's minimum-order check now runs against the amount after the
   * quantity offer, not against the raw subtotal. So a cart that clears a ₹3,500 minimum
   * on its subtotal can legitimately fail it once a 15% quantity offer has come off, and
   * the API's own message explains that.
   */
  const amountAfterQuantityOffer = Math.max(0, subtotal - quantityDiscount)
  const total = Math.max(0, amountAfterQuantityOffer + shipping - couponDiscount)

  /** What the customer saved overall: product reduction + quantity offer + coupon. */
  const totalSavings = totalDiscount + quantityDiscount + couponDiscount

  /**
   * Reads a failed checkout for the structured blockers the backend can return, and
   * routes the shopper accordingly.
   *
   * Returns true when it handled the error itself, so the caller skips the generic
   * message — showing "Unable to start payment" on top of a specific, actionable list
   * would bury the only part the shopper can do something about.
   */
  const handleCheckoutError = (error: unknown): boolean => {
    // Buy Now: the one item is gone. Only the product page can offer another size or
    // colour, so that is where they go.
    if (isBuyNow && isBuyNowUnavailable(error)) {
      clearBuyNowIntent()
      setSubmitError(null)
      navigate(`/product/${buyNow?.productId ?? ''}`, { replace: true })
      return true
    }

    const unavailable = readUnavailableItems(error)
    const insufficient = readInsufficientStock(error)

    if (unavailable.length === 0 && insufficient.length === 0) return false

    setUnavailableItems(unavailable)
    setInsufficientStock(insufficient)
    setSubmitError(null)
    return true
  }

  /** Clears a blocking line from the cart, then re-reads so the summary matches. */
  const handleRemoveUnavailable = async (item: UnavailableItemDto) => {
    if (removingItemId !== null) return

    setRemovingItemId(item.cart_item_id)
    try {
      await removeCartItem(item.cart_item_id)
      await refreshCart()
      setUnavailableItems((previous) => previous.filter((entry) => entry.cart_item_id !== item.cart_item_id))
    } catch (error) {
      setSubmitError(readPaymentApiError(error, 'Could not remove that item. Please try from the cart.'))
    } finally {
      setRemovingItemId(null)
    }
  }

  /**
   * Everything that has to happen once an order genuinely exists.
   *
   * The backend also removes that size from the cart on a Buy Now order, so the cart is
   * re-read rather than assumed — otherwise the header badge would keep counting an item
   * that is no longer there.
   */
  const finishOrder = async () => {
    clearBuyNowIntent()
    clear()
    await refreshCart()
  }

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
    setUnavailableItems([])
    setInsufficientStock([])
    paymentInFlight.current = true
    setBusy(true)

    let paymentOrder: Awaited<ReturnType<typeof createPaymentOrder>>
    try {
      // Only send coupon_code when one is actually applied, and only send the Buy Now
      // fields in Buy Now mode — sending them otherwise would reduce the whole cart to
      // one item.
      paymentOrder = await createPaymentOrder({
        address_id: addressId,
        ...(appliedCoupon?.code ? { coupon_code: appliedCoupon.code } : {}),
        ...(buyNow ? { variant_size_id: buyNow.variantSizeId, quantity: buyNow.quantity } : {}),
      })
    } catch (err) {
      // Razorpay checkout now returns `unavailable_items` too, not just COD.
      if (!handleCheckoutError(err)) {
        setSubmitError(readPaymentApiError(err, 'Unable to start payment. Please try again.'))
      }
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
      theme: { color: '#3b2118' },
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
        await finishOrder()
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
    setUnavailableItems([])
    setInsufficientStock([])
    paymentInFlight.current = true
    setBusy(true)

    /** Releases the submit guard so the customer can retry after any failure. */
    const release = () => {
      paymentInFlight.current = false
      setBusy(false)
    }

    let codOrder: Awaited<ReturnType<typeof createCodOrder>>
    try {
      // Only send coupon_code when a coupon is actually applied, and the Buy Now fields
      // only in Buy Now mode.
      codOrder = await createCodOrder({
        address_id: addressId,
        ...(appliedCoupon?.code ? { coupon_code: appliedCoupon.code } : {}),
        ...(buyNow ? { variant_size_id: buyNow.variantSizeId, quantity: buyNow.quantity } : {}),
      })
    } catch (err) {
      if (!handleCheckoutError(err)) {
        setSubmitError(readPaymentApiError(err, 'Could not place your order. Please try again.'))
      }
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
    await finishOrder()
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
        {isBuyNow
          ? 'Buying one item directly — the rest of your cart is untouched.'
          : 'Review your delivery details and order before placing your order.'}
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
            error={addressError}
          />

          <section className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <h2 className="type-section-title">Your Order</h2>
              {/* Quantities and removals stay on the Cart page, which owns them — this is a
                  review step, so it links there rather than duplicating those controls.
                  In Buy Now mode the cart is not involved at all, so the link goes back to
                  the product, which is the only place this item can be changed. */}
              {isBuyNow ? (
                <Link
                  to={`/product/${buyNow.productId}`}
                  className="inline-flex min-h-[32px] items-center font-sans text-xs font-semibold text-black underline underline-offset-2 dark:text-white"
                >
                  Change item
                </Link>
              ) : (
                <Link
                  to="/cart"
                  className="inline-flex min-h-[32px] items-center font-sans text-xs font-semibold text-black underline underline-offset-2 dark:text-white"
                >
                  Edit cart
                </Link>
              )}
            </div>
            <ul className="mt-5 divide-y divide-zinc-100 dark:divide-zinc-900">
              {items.map((i) => (
                <li key={i.key} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <img
                    src={i.image}
                    alt=""
                    className="size-[88px] shrink-0 border border-zinc-200 object-cover dark:border-zinc-800"
                  />
                  {/* Name, then the variant line, then the price — stacked, so the row reads
                      top-to-bottom instead of splitting the price off to the far edge. */}
                  <div className="min-w-0 flex-1">
                    <p className="font-sans text-sm font-bold text-black dark:text-white">{i.name}</p>
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
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/*
            Items the backend refused. Shown as an actionable list rather than a sentence:
            each line names the product and offers the one fix that works — removing it —
            so the shopper is not sent to the cart to work out which of twelve lines is
            the problem.
          */}
          {unavailableItems.length > 0 ? (
            <section className="border border-burgundy/40 bg-soft-beige p-5" role="alert">
              <h2 className="font-sans text-sm font-bold text-espresso">
                {unavailableItems.length === 1
                  ? 'One item is no longer available'
                  : `${unavailableItems.length} items are no longer available`}
              </h2>
              <p className="type-body-sm mt-1">Remove them to continue with the rest of your order.</p>

              <ul className="mt-4 space-y-2">
                {unavailableItems.map((item) => (
                  <li
                    key={item.cart_item_id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-sand pt-2 first:border-t-0 first:pt-0"
                  >
                    <span className="min-w-0 font-sans text-sm text-espresso">
                      <span className="font-semibold">{item.product_name}</span>
                      {[item.size, item.color].filter(Boolean).length > 0 ? (
                        <span className="text-zinc-600"> — {[item.size, item.color].filter(Boolean).join(' · ')}</span>
                      ) : null}
                    </span>

                    <button
                      type="button"
                      onClick={() => void handleRemoveUnavailable(item)}
                      disabled={removingItemId === item.cart_item_id}
                      className="inline-flex min-h-[32px] shrink-0 items-center font-sans text-xs font-semibold uppercase tracking-wide text-burgundy underline underline-offset-2 disabled:opacity-50"
                    >
                      {removingItemId === item.cart_item_id ? 'Removing…' : 'Remove'}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/*
            Not enough stock. Deliberately separate from the list above: there is no
            `cart_item_id` here and the fix is different — lower the quantity, not remove
            the line — so offering a Remove button would be the wrong advice.
          */}
          {insufficientStock.length > 0 ? (
            <section className="border border-burgundy/40 bg-soft-beige p-5" role="alert">
              <h2 className="font-sans text-sm font-bold text-espresso">Not enough stock</h2>
              <p className="type-body-sm mt-1">Reduce the quantity in your cart to continue.</p>

              <ul className="mt-4 space-y-2">
                {insufficientStock.map((item, index) => (
                  <li key={`${item.product_name}-${index}`} className="font-sans text-sm text-espresso">
                    <span className="font-semibold">{item.product_name}</span>
                    {[item.size, item.color].filter(Boolean).length > 0 ? (
                      <span className="text-zinc-600"> — {[item.size, item.color].filter(Boolean).join(' · ')}</span>
                    ) : null}
                    <span className="text-zinc-600">
                      {' '}
                      · you asked for {item.requested}, {item.available} left
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                to="/cart"
                className="mt-4 inline-flex min-h-[32px] items-center font-sans text-xs font-semibold uppercase tracking-wide text-burgundy underline underline-offset-2"
              >
                Edit cart
              </Link>
            </section>
          ) : null}

          {submitError ? (
            <p className="text-sm font-medium text-red-600 dark:text-red-400" role="alert">
              {submitError}
            </p>
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

                {/*
                  The quantity offer gets its own line, ABOVE the coupon, because that is
                  the order the backend applies them in — and the coupon's minimum-order
                  check runs against the amount left after this.
                */}
                {quantityDiscount > 0 ? (
                  <div className="flex justify-between gap-3 text-burgundy">
                    <span className="min-w-0">
                      Quantity offer
                      {quantityTier ? (
                        <span className="text-zinc-500">
                          {' '}
                          ({quantityTier.discount_percentage}% off on {quantityTier.min_quantity}+)
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0">-{formatInr(quantityDiscount)}</span>
                  </div>
                ) : null}

                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Shipping</span>
                  <span>{shipping === 0 ? 'Free' : formatInr(shipping)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
            {/*
              The coupon is validated against the amount AFTER the quantity offer, which is
              what the backend checks a coupon's minimum order against. Passing the raw
              subtotal here would let a coupon look applicable in the UI and then be
              refused on submit.
            */}
            <CouponSection
              cartTotal={amountAfterQuantityOffer}
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
                last thing read before the click. */}
            <Button size="lg" type="button" onClick={submit} disabled={busy} className="w-full">
              {busy ? 'Saving…' : `Place Order · ${formatInr(total)}`}
            </Button>

            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
              <IconLock className="size-3.5 shrink-0" />
              Secure checkout <span aria-hidden>·</span> Easy returns
            </p>
          </div>

          <p className="border-t border-zinc-200 pt-5 text-center text-[11px] text-zinc-500 dark:border-zinc-800">
            Need help with your order?{' '}
            <Link to="/help-desk" className="font-semibold text-black underline underline-offset-2 dark:text-white">
              Help Desk
            </Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
