import api from './axios'
import type {
  CheckoutErrorData,
  CodOrderResponse,
  CreateCodOrderDto,
  CreatePaymentOrderDto,
  CreatePaymentOrderResponse,
  InsufficientStockDto,
  RazorpayHandlerResponse,
  UnavailableItemDto,
  VerifyPaymentDto,
  VerifyPaymentResponse,
} from '@/types/api/PaymentDto'

/**
 * Payment API — Razorpay order creation, server-side payment verification, and the
 * dedicated Cash on Delivery order endpoint.
 *
 * VERIFIED LIVE: POST /v1/checkout_payment/ and POST /v1/verify_payment_api/ both exist and
 * are authentication-gated (401 "Authorization token missing." unauthenticated; a
 * non-existent path returns 404). The request contract for checkout_payment comes from the
 * backend's published OpenAPI schema (`CheckoutOrderRequest`: address_id + optional
 * coupon_code).
 *
 * NOT VERIFIED: the 201/200 success payloads — completing a real Razorpay payment needs
 * credentials and a card flow that are not available in this environment. Field names below
 * follow the documented contract exactly and are used verbatim.
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
 * Loads Razorpay Standard Checkout from Razorpay's CDN, once.
 *
 * Resolves false when the script cannot load, so callers can fail cleanly instead of
 * throwing. Nothing is self-hosted and no stub implementation is ever substituted.
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
 * null placeholder is ever sent. The returned `amount` is authoritative and in paise.
 */
export async function createPaymentOrder(payload: CreatePaymentOrderDto): Promise<CreatePaymentOrderResponse> {
  const body: CreatePaymentOrderDto = { address_id: payload.address_id }
  const code = payload.coupon_code?.trim()
  if (code) body.coupon_code = code

  /*
   * Buy Now. Both fields are OMITTED unless a `variant_size_id` is genuinely present —
   * sending them for an ordinary cart checkout would make the backend build the order
   * from that one item and ignore the cart. `quantity` is only meaningful alongside the
   * id, so it is gated on the same condition rather than sent on its own.
   */
  if (payload.variant_size_id !== undefined) {
    body.variant_size_id = payload.variant_size_id
    body.quantity = Math.max(1, payload.quantity ?? 1)
  }

  const response = await api.post<CreatePaymentOrderResponse>('/v1/checkout_payment/', body)
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
  const response = await api.post<VerifyPaymentResponse>('/v1/verify_payment_api/', {
    razorpay_order_id: payload.razorpay_order_id,
    razorpay_payment_id: payload.razorpay_payment_id,
    razorpay_signature: payload.razorpay_signature,
  })
  return response.data
}

/**
 * POST /v1/cod_order/ — places a Cash on Delivery order.
 *
 * This is a DEDICATED endpoint and a completely separate flow: it never touches
 * /v1/checkout_payment/, /v1/verify_payment_api/ or the Razorpay SDK. The backend creates
 * the order and computes subtotal/discount/grand_total itself, so nothing in the returned
 * `data` is recalculated from cart values here.
 *
 * Body construction mirrors `createPaymentOrder`: `address_id` always, and `coupon_code`
 * only when a coupon is actually applied — never "", never null, and never `coupon_id`.
 *
 * Auth, base URL and the token header all come from the shared `api` client; no separate
 * client, axios instance or auth helper is involved.
 */
export async function createCodOrder(payload: CreateCodOrderDto): Promise<CodOrderResponse> {
  const body: CreateCodOrderDto = { address_id: payload.address_id }
  const code = payload.coupon_code?.trim()
  if (code) body.coupon_code = code

  // Buy Now — same rule as `createPaymentOrder`: omitted entirely for a cart checkout.
  if (payload.variant_size_id !== undefined) {
    body.variant_size_id = payload.variant_size_id
    body.quantity = Math.max(1, payload.quantity ?? 1)
  }

  const response = await api.post<CodOrderResponse>('/v1/cod_order/', body)
  return response.data
}

/* ------------------------------------------------------- structured 400 bodies */

/**
 * Items the backend refused because they are no longer purchasable.
 *
 * Returned by BOTH checkout endpoints inside a 400 as `data.unavailable_items`. Each
 * entry carries its `cart_item_id`, which is exactly what `DELETE /v1/cart_management/`
 * takes — so the checkout can offer to clear the blockage instead of showing a message the
 * shopper cannot act on.
 *
 * Returns an empty array for any other error, so callers can branch on `.length`.
 */
export function readUnavailableItems(error: unknown): UnavailableItemDto[] {
  const data = (error as { response?: { data?: CheckoutErrorData } }).response?.data
  return Array.isArray(data?.unavailable_items) ? data.unavailable_items : []
}

/**
 * Items where the cart asks for more units than exist.
 *
 * Returned inside a 400 as `data.insufficient_stock`. There is no `cart_item_id` here, so
 * the fix is to lower the quantity rather than remove the line — which is why this is a
 * separate reader and a separate message rather than being folded into the one above.
 */
export function readInsufficientStock(error: unknown): InsufficientStockDto[] {
  const data = (error as { response?: { data?: CheckoutErrorData } }).response?.data
  return Array.isArray(data?.insufficient_stock) ? data.insufficient_stock : []
}

/**
 * True when a Buy Now attempt failed because the chosen item is gone.
 *
 * The backend answers 400 with this exact wording. There is no structured field for it,
 * so the message is matched — loosely, on the distinctive part, so a trailing full stop
 * or a reworded prefix does not break the check. The caller sends the shopper back to the
 * product page, which is the only place they can pick a different size or colour.
 */
/**
 * True when the backend refused because it believes the CART is empty.
 *
 * Harmless in a normal cart checkout — it just means the cart emptied in another tab.
 *
 * In BUY NOW mode it means something quite different and much more useful: the request
 * carried `variant_size_id`, so the backend should never have looked at the cart at all.
 * Getting this back says the endpoint ignored the field — it has not deployed Buy Now
 * support, or it expects a different field name. The checkout says so plainly instead of
 * showing the shopper a cart error for an order that has nothing to do with their cart.
 */
export function isCartEmptyError(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: PaymentEnvelope } }).response
  if (!response?.status || response.status >= 500) return false

  const message = readMessage(response.data?.message).toLowerCase()
  return message.includes('cart is empty') || message.includes('cart empty')
}

export function isBuyNowUnavailable(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: PaymentEnvelope } }).response
  if (response?.status !== 400) return false

  const message = readMessage(response.data?.message).toLowerCase()
  return message.includes('no longer available')
}
