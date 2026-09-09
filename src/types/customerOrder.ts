/**
 * Customer order-history model — the shape GET /v1/orders/ maps into.
 *
 * This is deliberately NOT the `Order` type in `@/types`. That one models the LOCAL
 * order-log resource (Checkout posts it to /api/orders, the WhatsApp handoff formats it,
 * and the admin order hook narrows its `status` to a three-value union). Backend order
 * history is a different resource with a server-owned status vocabulary, so reusing that
 * type would mean widening a union the admin and checkout code depend on — changes both
 * out of scope here and unsafe. The local `Order` type is untouched.
 *
 * Every field that the backend may not return is optional or nullable, and the UI renders
 * only what is actually present rather than substituting placeholder values.
 */

export interface CustomerOrderItem {
  /** Stable key for rendering; falls back to the list index when the API sends no id. */
  key: string
  /**
   * The product's own id, used for the existing `/product/:id` route. '' when the response
   * carries no product-specific id — the UI then renders the item without a link rather
   * than guessing one from the order-line id.
   */
  productId: string
  name: string
  imageUrl: string
  size: string
  color: string
  /** null when the backend did not report a quantity. */
  quantity: number | null
  /** Per-unit price, or null when the backend did not report one. */
  price: number | null
}

export interface CustomerOrder {
  /** The backend's order id, used for GET /v1/orders/?id=<id>. */
  id: string
  /** Human-facing reference; the order number when provided, otherwise the id. */
  reference: string
  /** Raw backend date string, preserved as received. '' when absent. */
  date: string
  /** Raw backend status value, preserved exactly as received. '' when absent. */
  status: string
  /** Order total as reported by the backend, or null when it reports none. */
  total: number | null
  items: CustomerOrderItem[]

  /**
   * Fields the admin order list needs. They are additive and optional: the customer page
   * ignores them, so there is one order model rather than two competing ones.
   *
   * `trackingId`/`courierName` use the names CONFIRMED by the PUT contract, and
   * `paymentMethod`/`paymentStatus` the names from the observed COD order response.
   * `customerName`/`customerEmail` are resolved from candidates — the backend is known to
   * hold them (admin search matches on customer name and email) but their JSON field names
   * are not published, so they stay '' when unmatched and the UI simply omits them.
   */
  customerName: string
  customerEmail: string
  paymentMethod: string
  paymentStatus: string
  trackingId: string
  courierName: string
}

/** Pagination metadata, populated only from fields the response actually contains. */
export interface OrderPageInfo {
  /** True only when the response explicitly indicates a further page exists. */
  hasNextPage: boolean
  /** Total order count when reported. */
  totalCount: number | null
}

export interface CustomerOrderPage {
  orders: CustomerOrder[]
  pageInfo: OrderPageInfo
}
