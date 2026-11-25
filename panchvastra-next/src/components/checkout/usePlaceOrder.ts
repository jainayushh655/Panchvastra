'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthProvider'
import { useCart } from '@/context/CartProvider'
import { unavailableLines } from '@/lib/cartAvailability'
import {
  createCodOrder,
  createPaymentOrder,
  isAmbiguousPaymentOutcome,
  loadRazorpayScript,
  readPaymentApiError,
  verifyPayment,
} from '@/services/payment'
import type { ProfileAddress } from '@/lib/mockProfile'

/**
 * Order placement, kept out of the checkout's presentation.
 *
 * Ported from the two submit handlers in the Vite `CheckoutPage`. The guards, the order of
 * operations, the messages and — most importantly — the rule about WHEN the cart may be
 * cleared are unchanged. What is new is the third verification outcome; see below.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE CART IS CLEARED IN EXACTLY TWO PLACES
 * ──────────────────────────────────────────────────────────────────────────────
 *   1. after `verifyPayment` returns `success: true`;
 *   2. after `createCodOrder` returns `success: true` AND a real `data.order_id`.
 *
 * Nowhere else. Not on dismissal, not on `payment.failed`, not on a rejected verification,
 * and explicitly not when the outcome is unknown — a shopper whose connection dropped
 * mid-verification must still have their cart when they come back, because the alternative
 * is an empty cart and no visible order.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ⚠️ THE THIRD OUTCOME, AND WHY IT EXISTS
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite page has two branches after `verifyPayment`: success, or "we couldn't verify
 * your payment — please try again or contact support", which it shows for a rejected
 * signature AND for a timeout alike. Those are not the same event. A 400 saying the
 * signature does not match is a fact; a request that never came back is the absence of
 * one, and the money may well have moved. Telling someone their payment failed when it may
 * have succeeded invites them to pay twice.
 *
 * So an ambiguous outcome (`isAmbiguousPaymentOutcome`) now gets its own state: the
 * customer is told verification is PENDING, given the order reference, and sent to their
 * orders to check — and the submit path stays locked so a second attempt cannot be made
 * before the first is resolved.
 *
 * NO RECOVERY IS ATTEMPTED FROM HERE, and none is invented. The only existing endpoint
 * that could report payment status is `GET /v1/orders/?id=`, which returns a single order
 * DETAIL object — a shape this application's order reader does not parse and which has
 * never been observed. Guessing at it would be inventing a contract. Reconciliation
 * belongs on the backend (a Razorpay webhook); this is recorded as a cutover blocker.
 */

export type PaymentMethod = 'upi' | 'cod'

/**
 * A payment whose outcome could not be established. Held in memory only, for the length of
 * the page view.
 *
 * ⚠️ NOTHING SENSITIVE IS KEPT. The Razorpay SIGNATURE is never stored, never logged and
 * never leaves the verification request, and none of this is written to `localStorage` —
 * a payment reference persisted in browser storage is a liability with no owner.
 */
export type PendingVerification = {
  /**
   * Which flow was interrupted, because the honest wording differs. A Razorpay payment
   * may already have taken the customer's money; a COD order cannot have, and telling a
   * cash-on-delivery customer to check their bank would be alarming nonsense.
   */
  kind: 'payment' | 'order'
  /** The application's own order id from `createPaymentOrder`. Safe to show. */
  orderId: number | null
  /** The Razorpay order reference. A public identifier, not a credential. */
  razorpayOrderId: string | null
}

type PlaceOrderArgs = {
  method: PaymentMethod
  address: ProfileAddress | undefined
  couponCode?: string | null
}

export function usePlaceOrder() {
  const router = useRouter()
  const { items, clear } = useCart()
  const { user } = useAuth()

  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [pendingVerification, setPendingVerification] = useState<PendingVerification | null>(null)

  /**
   * Synchronous duplicate-submission guard.
   *
   * A ref, not state: state updates are not committed until the next render, so two clicks
   * dispatched in the same tick would both pass a state check. This is read and written
   * immediately.
   */
  const paymentInFlight = useRef(false)

  /**
   * Latched once an outcome becomes unknown, and never released by this hook.
   *
   * While it is set, no further order can be created from this page view. That is the
   * point: until someone knows whether the first payment landed, a second attempt is the
   * one action that can actually cost the customer money twice.
   */
  const lockedRef = useRef(false)

  /** Releases the submit guard so the customer can retry after a DEFINITE failure. */
  const release = useCallback(() => {
    paymentInFlight.current = false
    setBusy(false)
  }, [])

  /** Locks the page after an unknown outcome. Deliberately has no counterpart. */
  const lock = useCallback((pending: PendingVerification) => {
    lockedRef.current = true
    paymentInFlight.current = true
    setBusy(false)
    setPendingVerification(pending)
  }, [])

  const succeed = useCallback(() => {
    // The backend has confirmed it — only now is the cart cleared.
    clear()
    release()
    router.replace('/orders')
  }, [clear, release, router])

  /**
   * Everything that must be true before ANY request is made.
   *
   * Returns the numeric address id, or null having already set the right message. The
   * stock check runs first: it is the cheapest, it is the one the customer can act on
   * directly, and an unavailable line makes the rest moot.
   */
  const validate = useCallback(
    (address: ProfileAddress | undefined): number | null => {
      if (!items.length) return null

      if (unavailableLines(items).length > 0) {
        setSubmitError('Some items are no longer available. Please update your cart before placing the order.')
        return null
      }

      if (!address) {
        setAddressError('Please select a delivery address before placing your order.')
        return null
      }

      const addressId = Number(address.id)
      if (!Number.isFinite(addressId)) {
        setAddressError('Please select a delivery address before placing your order.')
        return null
      }

      setAddressError(null)
      setSubmitError(null)
      return addressId
    },
    [items],
  )

  /**
   * Online payment via Razorpay.
   *
   * The backend owns the payable amount and the order: no amount is ever derived from cart
   * totals here, and the payment only counts once `verify_payment_api` confirms the
   * signature.
   */
  const payWithRazorpay = useCallback(
    async (address: ProfileAddress | undefined, couponCode?: string | null) => {
      const addressId = validate(address)
      if (addressId === null || !address) return

      paymentInFlight.current = true
      setBusy(true)

      let paymentOrder: Awaited<ReturnType<typeof createPaymentOrder>>
      try {
        // Only send coupon_code when one is actually applied.
        paymentOrder = await createPaymentOrder({
          address_id: addressId,
          ...(couponCode ? { coupon_code: couponCode } : {}),
        })
      } catch (err) {
        setSubmitError(readPaymentApiError(err, 'Unable to start payment. Please try again.'))
        release()
        return
      }

      // The success payload has never been observed, so the two fields this flow cannot
      // proceed without are checked rather than assumed.
      if (!paymentOrder?.razorpay_order_id || !paymentOrder.key) {
        setSubmitError('Unable to start payment. Please try again.')
        release()
        return
      }

      const loaded = await loadRazorpayScript()
      if (!loaded || !window.Razorpay) {
        setSubmitError('Could not load the payment gateway. Please check your connection and try again.')
        release()
        return
      }

      /*
       * Razorpay can fire `handler` more than once for a single payment (duplicate or
       * replayed callbacks). One payment must produce exactly one verification, so the
       * first invocation claims this attempt and any repeat is ignored. Scoped to THIS
       * attempt, so a real retry — which creates a new Razorpay order — still verifies.
       */
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
          name: address.fullName,
          email: user?.email ?? '',
          contact: address.phone,
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
              // (A) The backend answered, and the answer is no. Its own wording is shown.
              setSubmitError(
                verified?.message || "We couldn't verify your payment. Please try again or contact support.",
              )
              release()
              return
            }
          } catch (err) {
            if (isAmbiguousPaymentOutcome(err)) {
              // (C) No answer. The payment may have gone through, so nothing is declared
              // failed, nothing is cleared, and no second attempt is permitted.
              lock({
                kind: 'payment',
                orderId: paymentOrder.order_id ?? null,
                razorpayOrderId: response.razorpay_order_id ?? null,
              })
              return
            }

            // (A) A definite 4xx rejection.
            setSubmitError(
              readPaymentApiError(err, "We couldn't verify your payment. Please try again or contact support."),
            )
            release()
            return
          }

          // (B) Verified by the backend — only now is the order paid.
          succeed()
        },
      })

      checkout.on?.('payment.failed', () => {
        setSubmitError('Your payment could not be completed. Please try again.')
        release()
      })

      checkout.open()
    },
    [lock, release, succeed, user?.email, validate],
  )

  /**
   * Cash on delivery via the dedicated backend endpoint.
   *
   * Entirely separate from the Razorpay flow: it never calls `checkout_payment` or
   * `verify_payment_api`, and never loads or opens the Razorpay SDK. The backend creates
   * the order and owns subtotal / discount / grand_total, so no amount is derived here.
   */
  const submitCod = useCallback(
    async (address: ProfileAddress | undefined, couponCode?: string | null) => {
      const addressId = validate(address)
      if (addressId === null) return

      paymentInFlight.current = true
      setBusy(true)

      let codOrder: Awaited<ReturnType<typeof createCodOrder>>
      try {
        // Only send coupon_code when a coupon is actually applied.
        codOrder = await createCodOrder({
          address_id: addressId,
          ...(couponCode ? { coupon_code: couponCode } : {}),
        })
      } catch (err) {
        /*
         * A COD post that never came back is ambiguous too: the order may exist. It is a
         * milder case than a paid Razorpay order — no money has moved — but a second POST
         * could still create a duplicate order, so the same lock applies.
         */
        if (isAmbiguousPaymentOutcome(err)) {
          lock({ kind: 'order', orderId: null, razorpayOrderId: null })
          return
        }
        setSubmitError(readPaymentApiError(err, 'Could not place your order. Please try again.'))
        release()
        return
      }

      // Only an explicit success from the backend counts as a placed order. The response
      // shape has never been observed, so both conditions are checked.
      if (!codOrder?.success) {
        // The backend said no. A definite answer: show it and allow a retry.
        setSubmitError(codOrder?.message || 'Could not place your order. Please try again.')
        release()
        return
      }

      if (!codOrder.data?.order_id) {
        /*
         * ⚠️ `success: true` WITH NO ORDER ID IS AMBIGUOUS, NOT A FAILURE.
         *
         * The Vite page treats this as a plain failure and re-enables the button. Two
         * things are wrong with that. The backend has just said it SUCCEEDED, so an order
         * may well exist — and retrying would then create a second one. And the message it
         * shows is the backend's own, which in this branch reads "Order placed." — a
         * success sentence displayed in red as an error.
         *
         * Since the response shape has never been observed, this is exactly the case to be
         * careful about: treat it like an interrupted payment. Lock the page, say the
         * outcome is pending, and send the customer to their orders to check.
         */
        lock({ kind: 'order', orderId: null, razorpayOrderId: null })
        return
      }

      // The backend has created the order — only now is the cart cleared.
      succeed()
    },
    [lock, release, succeed, validate],
  )

  /** Routes Place Order to the flow the customer actually chose. */
  const placeOrder = useCallback(
    ({ method, address, couponCode }: PlaceOrderArgs) => {
      if (!items.length) return
      // Both guards are synchronous and both are checked on every entry: the in-flight ref
      // for a double click, the lock for an unresolved payment.
      if (paymentInFlight.current || lockedRef.current) return

      if (method === 'cod') void submitCod(address, couponCode)
      else void payWithRazorpay(address, couponCode)
    },
    [items.length, payWithRazorpay, submitCod],
  )

  return {
    placeOrder,
    busy,
    submitError,
    addressError,
    setAddressError,
    /** Set only when a payment's outcome could not be established. */
    pendingVerification,
    /** True while no further order may be placed from this page view. */
    locked: pendingVerification !== null,
  }
}
