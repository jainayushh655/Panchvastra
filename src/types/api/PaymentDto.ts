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

/**
 * Buy Now fields, accepted by BOTH checkout endpoints.
 *
 * ⚠️ Sending `variant_size_id` changes what the order IS. The backend then builds the
 * order from that one item and ignores the cart entirely. Leaking these fields into an
 * ordinary cart checkout would silently reduce a full cart to a single item, so they are
 * only ever set from the Buy Now flow and are omitted — not nulled — otherwise.
 */
export interface BuyNowFields {
  /** The exact variant size being bought. Its presence is what selects Buy Now mode. */
  variant_size_id?: number
  /** Units of that size. Only meaningful alongside `variant_size_id`. */
  quantity?: number
}

/** Request body for POST /v1/checkout_payment/. `coupon_code` is omitted when unused. */
export interface CreatePaymentOrderDto extends BuyNowFields {
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
export interface CreateCodOrderDto extends BuyNowFields {
  address_id: number
  coupon_code?: string
}

/**
 * An item the backend refused because it is no longer purchasable.
 *
 * Returned inside a 400 as `data.unavailable_items`, by BOTH the COD and the Razorpay
 * endpoints. `cart_item_id` is what the remove call needs, so the checkout can offer to
 * clear the blockage rather than leaving the shopper stuck.
 */
export interface UnavailableItemDto {
  cart_item_id: number
  product_name: string
  size: string | null
  color: string | null
}

/**
 * An item the backend refused because the cart asks for more than exists.
 *
 * Returned inside a 400 as `data.insufficient_stock`. There is no `cart_item_id` here —
 * the fix is to reduce the quantity, not to remove the line.
 */
export interface InsufficientStockDto {
  product_name: string
  size: string | null
  color: string | null
  requested: number
  available: number
}

/** The `data` block a 400 from either checkout endpoint can carry. */
export interface CheckoutErrorData {
  unavailable_items?: UnavailableItemDto[]
  insufficient_stock?: InsufficientStockDto[]
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
  /**
   * The COMBINED saving: quantity offer + coupon.
   *
   * To show them separately, the coupon part is `discount_amount − quantity_discount_amount`.
   * There is no separate coupon field, so that subtraction is the only way to split them.
   */
  discount_amount: number
  /** The quantity-offer portion of `discount_amount`. Optional on older responses. */
  quantity_discount_amount?: number
  grand_total: number
}

/** Response envelope from POST /v1/cod_order/. */
export interface CodOrderResponse {
  success: boolean
  message: string
  data: CodOrderData
}
