/**
 * Payment contract for /v1/checkout_payment/ and /v1/verify_payment_api/.
 *
 * VERIFIED LIVE: both paths exist and are authentication-gated — unauthenticated POSTs
 * return 401 {"success": false, "message": "Authorization token missing.", "data": {}},
 * while a non-existent path returns 404.
 *
 * VERIFIED from the backend's published OpenAPI schema (GET /api/schema/):
 * POST /v1/checkout_payment/ ("Create Razorpay Order") takes `CheckoutOrderRequest`:
 * `address_id` (integer, required) and `coupon_code` (string, nullable).
 */

/** Request body for POST /v1/checkout_payment/. `coupon_code` is omitted when unused. */
export interface CreatePaymentOrderDto {
  address_id: number
  coupon_code?: string
}

/**
 * 201 response from POST /v1/checkout_payment/.
 *
 * `amount` is ALREADY IN PAISE and is the authoritative payable amount — it is passed to
 * Razorpay untouched and never recomputed from cart totals.
 */
export interface CreatePaymentOrderResponse {
  success: boolean
  /** The application's own numeric order id — NOT the id given to Razorpay. */
  order_id: number
  /** The Razorpay order id — this is what Razorpay Checkout's `order_id` needs. */
  razorpay_order_id: string
  /** Already in paise. Do not multiply. */
  amount: number
  currency: string
  /** Public Razorpay Key ID. The secret never reaches the frontend. */
  key: string
}

/** Request body for POST /v1/verify_payment_api/ — exactly what Razorpay handed back. */
export interface VerifyPaymentDto {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

/** Response from POST /v1/verify_payment_api/. */
export interface VerifyPaymentResponse {
  success: boolean
  message?: string
}

/** The subset of Razorpay Checkout's success payload this flow uses. */
export interface RazorpayHandlerResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

/**
 * Request body for POST /v1/cod_order/ — the dedicated Cash on Delivery endpoint.
 *
 * Separate from `CreatePaymentOrderDto` on purpose: COD is its own backend flow and must
 * never share a code path with checkout_payment/verify_payment_api. `coupon_code` is
 * omitted entirely when no coupon is applied — never sent as "" or null, and `coupon_id`
 * is never sent at all.
 */
export interface CreateCodOrderDto {
  address_id: number
  coupon_code?: string
}

/**
 * The order the COD endpoint creates. Every money field is authoritative: the backend has
 * already created the order and computed these, so they are never recalculated on the client.
 */
export interface CodOrderData {
  order_id: number
  order_number: string
  payment_method: string
  payment_status: string
  order_status: string
  subtotal: number
  discount_amount: number
  grand_total: number
}

/** Response envelope from POST /v1/cod_order/. */
export interface CodOrderResponse {
  success: boolean
  message: string
  data: CodOrderData
}
