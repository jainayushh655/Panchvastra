import api from '@/services/http/client'
import { ENDPOINTS } from '@/services/endpoints'
import type {
  CodOrderResponse,
  CreateCodOrderDto,
  CreatePaymentOrderDto,
  CreatePaymentOrderResponse,
  RazorpayHandlerResponse,
  VerifyPaymentDto,
  VerifyPaymentResponse,
} from '@/types/api/PaymentDto'

/**
 * Payment — Razorpay order creation, server-side verification, and the dedicated Cash on
 * Delivery endpoint.
 *
 * Ported from the Vite `src/api/payment.ts`. Every request body, every field name and the
 * SDK loading strategy are unchanged; only the path literals became `ENDPOINTS` constants
 * and the client import moved to the shared one.
 *
 * VERIFIED LIVE (by the Vite app): `POST /v1/checkout_payment/` and
 * `POST /v1/verify_payment_api/` both exist and are authentication-gated — an
 * unauthenticated POST returns 401 "Authorization token missing.", while a non-existent
 * path returns 404. The request contract for checkout_payment comes from the backend's
 * published OpenAPI schema (`CheckoutOrderRequest`: `address_id` + optional `coupon_code`).
 *
 * ⚠️ NOT VERIFIED: the 2xx payloads of ANY of the three endpoints. Completing a real
 * payment needs credentials and a card flow that were not available, so every response
 * field below is transcribed from the documented contract and has never been observed.
 * That is why each caller checks for the fields it needs instead of trusting the shape.
 *
 * Auth header, base URL and interceptors all come from the shared `api` client. The
 * Razorpay Key SECRET never appears here — only the public Key ID the backend returns.
 */

const RAZORPAY_SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js'

type PaymentEnvelope = {
  success?: boolean
  message?: string | Record<string, string[]>
  data?: unknown
}

export type RazorpayOptions = {
  key: string
  amount: number
  currency: string
  order_id: string
  name?: string
  description?: string
  prefill?: { name?: string; email?: string; contact?: string }
  theme?: { color?: string }
  handler: (response: RazorpayHandlerResponse) => void
  modal?: { ondismiss?: () => void }
}

export type RazorpayInstance = {
  open: () => void
  on?: (event: string, handler: (payload: unknown) => void) => void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance
  }
}

/** Flattens this backend's two `message` shapes (string, or field→messages) into one line. */
function readMessage(message: unknown): string {
  if (typeof message === 'string' && message.trim()) return message
  if (message && typeof message === 'object') {
    const parts: string[] = []
    for (const value of Object.values(message as Record<string, unknown>)) {
      if (Array.isArray(value)) parts.push(...value.filter((v): v is string => typeof v === 'string'))
      else if (typeof value === 'string') parts.push(value)
    }
    if (parts.length) return parts.join(' ')
  }
  return ''
}

/** Turns any thrown request error into a user-safe message (never a raw stack/SQL/trace). */
export function readPaymentApiError(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: PaymentEnvelope } }).response
  if (!response) return 'Unable to connect to the server. Please check your connection and try again.'

  const status = response.status
  if (status === 401 || status === 403) return 'Your session has expired. Please sign in again.'
  // 5xx bodies can carry raw exception text — never surface it.
  if (status && status >= 500) return 'The server is temporarily unavailable. Please try again shortly.'

  return readMessage(response.data?.message) || fallback
}

/**
 * True when a thrown request produced no definite answer from the server.
 *
 * This is the distinction the whole interrupted-payment story rests on: a 400 saying "the
 * signature does not match" is a FACT, while a timeout, an aborted request or a 5xx is the
 * absence of one. The first may be reported as a failure; the second may not, because the
 * money may well have moved.
 *
 * A request that never got a `response` (network loss, DNS, timeout, abort) and any 5xx
 * both count as ambiguous. 408 and 504 are called out explicitly because they are timeouts
 * that did come back with a status.
 */
export function isAmbiguousPaymentOutcome(error: unknown): boolean {
  const response = (error as { response?: { status?: number } } | undefined)?.response
  if (!response) return true

  const status = response.status
  if (typeof status !== 'number') return true
  return status >= 500 || status === 408
}

/**
 * Loads Razorpay Standard Checkout from Razorpay's CDN, once.
 *
 * Resolves false when the script cannot load, so callers can fail cleanly instead of
 * throwing. Nothing is self-hosted and no stub implementation is ever substituted — this
 * is deliberately NOT an npm dependency, matching the Vite app: Razorpay's hosted script
 * is the only supported way to run Standard Checkout, and vendoring it would pin a copy
 * of a file they expect to update.
 */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (window.Razorpay) return Promise.resolve(true)

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(Boolean(window.Razorpay)), { once: true })
      existing.addEventListener('error', () => resolve(false), { once: true })
      return
    }

    const script = document.createElement('script')
    script.src = RAZORPAY_SCRIPT_SRC
    script.async = true
    script.onload = () => resolve(Boolean(window.Razorpay))
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

/**
 * POST /v1/checkout_payment/ — creates the application order and its Razorpay order.
 *
 * `coupon_code` is only included when a coupon is actually applied; no empty string and no
 * null placeholder is ever sent. The returned `amount` is authoritative and in paise — it
 * is handed to Razorpay untouched and is never recomputed from cart totals.
 */
export async function createPaymentOrder(payload: CreatePaymentOrderDto): Promise<CreatePaymentOrderResponse> {
  const body: CreatePaymentOrderDto = { address_id: payload.address_id }
  const code = payload.coupon_code?.trim()
  if (code) body.coupon_code = code

  const response = await api.post<CreatePaymentOrderResponse>(ENDPOINTS.checkoutPayment, body)
  return response.data
}

/**
 * POST /v1/verify_payment_api/ — server-side signature verification.
 *
 * The three values are passed through exactly as Razorpay returned them; no signature is
 * generated, altered or checked on the client. This response is the ONLY thing that makes
 * a payment successful.
 */
export async function verifyPayment(payload: VerifyPaymentDto): Promise<VerifyPaymentResponse> {
  const response = await api.post<VerifyPaymentResponse>(ENDPOINTS.verifyPayment, {
    razorpay_order_id: payload.razorpay_order_id,
    razorpay_payment_id: payload.razorpay_payment_id,
    razorpay_signature: payload.razorpay_signature,
  })
  return response.data
}

/**
 * POST /v1/cod_order/ — places a Cash on Delivery order.
 *
 * A DEDICATED endpoint and a completely separate flow: it never touches
 * /v1/checkout_payment/, /v1/verify_payment_api/ or the Razorpay SDK. The backend creates
 * the order and computes subtotal/discount/grand_total itself, so nothing in the returned
 * `data` is recalculated on the client.
 *
 * Body construction mirrors `createPaymentOrder`: `address_id` always, and `coupon_code`
 * only when a coupon is actually applied — never "", never null, and never `coupon_id`.
 */
export async function createCodOrder(payload: CreateCodOrderDto): Promise<CodOrderResponse> {
  const body: CreateCodOrderDto = { address_id: payload.address_id }
  const code = payload.coupon_code?.trim()
  if (code) body.coupon_code = code

  const response = await api.post<CodOrderResponse>(ENDPOINTS.codOrder, body)
  return response.data
}
