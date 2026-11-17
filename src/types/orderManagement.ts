/**
 * The order model the customer list, admin list and admin detail screens all consume.
 *
 * One model, three screens. The API returns the same order shape to a customer token and
 * an admin token — the role only changes WHICH orders come back and whether `notes` is
 * populated — so a second parallel model would be two things to keep in sync for no gain.
 *
 * This replaces the old `@/types/customerOrder`, whose fields were candidate guesses made
 * when the payload was unpublished. It is deliberately NOT the `Order` type in `@/types`:
 * that one models the separate local order-log resource used by Checkout and the WhatsApp
 * handoff, and is untouched here.
 *
 * Nullability mirrors the contract exactly. A field that can be null IS null — never ''
 * or 0 standing in for "absent" — so the UI can decide to hide a row instead of printing
 * a placeholder for a value the backend never sent.
 */

export interface OrderItem {
  /** Order-line id. Used as a render key only; it is NOT the product id. */
  key: string
  /** Product id for the `/product/:id` route. null when the response carried none. */
  productId: string | null
  variantId: string | null
  productName: string
  color: string | null
  size: string | null
  quantity: number | null
  mrp: number | null
  sellingPrice: number | null
  /** Line total for the full quantity, as calculated by the backend. */
  totalAmount: number | null
  sku: string | null
  imageUrl: string | null
}

/**
 * One node of the progress bar.
 *
 * Rendered straight from the response: one node per entry, in array order. The length
 * varies (a cancelled order returns only the steps it reached plus CANCELLED), so nothing
 * here is padded to five and `DELIVERED` is never assumed to be last.
 */
export interface OrderTimelineStep {
  status: string
  label: string
  /** null whenever the step is not completed. */
  at: string | null
  completed: boolean
}

/** One entry of the detail screen's "Order Timeline" panel — distinct from the progress bar. */
export interface OrderStatusHistoryEntry {
  id: string
  status: string
  label: string
  note: string | null
  createdAt: string | null
  /** Admin-only surface. */
  createdBy: string | null
}

/** One internal note. Admin-only: a customer token always receives an empty list. */
export interface OrderNote {
  id: string
  note: string
  createdAt: string | null
  createdBy: string | null
}

export interface OrderAddress {
  customerName: string | null
  /** Shown, but never editable — the contract excludes it from the address PUT. */
  customerEmail: string | null
  customerMobile: string | null
  addressLine1: string | null
  addressLine2: string | null
  landmark: string | null
  city: string | null
  state: string | null
  country: string | null
  pincode: string | null
}

export interface OrderPriceSummary {
  subtotal: number | null
  /** Positive in the payload; the UI renders it as "- ₹499". */
  discountAmount: number | null
  shippingAmount: number | null
  taxAmount: number | null
  grandTotal: number | null
}

/** An order as the list endpoint returns it. */
export interface OrderSummary {
  id: string
  /** Powers the admin's "View Customer" link. */
  userId: string | null
  orderNumber: string
  customerName: string | null
  customerEmail: string | null
  customerMobile: string | null
  /** Raw status value, used for logic (e.g. the address lock) — never for display. */
  status: string
  /** The backend's own display text for the badge. Never derived from `status`. */
  statusLabel: string
  paymentStatus: string | null
  paymentMethod: string | null
  grandTotal: number | null
  totalItems: number | null
  /** Date only (`YYYY-MM-DD`), and nullable when the admin has not set one. */
  expectedDeliveryDate: string | null
  orderedAt: string | null
  processingAt: string | null
  shippedAt: string | null
  outForDeliveryAt: string | null
  deliveredAt: string | null
  cancelledAt: string | null
  trackingId: string | null
  courierName: string | null
  timeline: OrderTimelineStep[]
  items: OrderItem[]
}

/** An order as `?id=`, `PUT /v1/orders/` and `PUT /v1/orders/address/` return it. */
export interface OrderDetail extends OrderSummary {
  statusHistory: OrderStatusHistoryEntry[]
  /** Always empty for a customer token. */
  notes: OrderNote[]
  /** null for COD orders. */
  transactionId: string | null
  /** null for COD orders. */
  paidAt: string | null
  address: OrderAddress | null
  priceSummary: OrderPriceSummary | null
}

/** The envelope's `pagination` block, normalised. */
export interface OrderPagination {
  page: number
  pageSize: number | null
  /** The empty state keys off this being 0. */
  totalRecords: number | null
  totalPages: number | null
  hasNext: boolean
  hasPrevious: boolean
}

export interface OrderListResult {
  orders: OrderSummary[]
  pagination: OrderPagination
  /** The envelope's own `message` — written for end users, shown as-is on an empty list. */
  message: string
}
