/**
 * Order management contract — the wire shapes for every `/v1/orders/...` endpoint.
 *
 * These field names come from the published API contract, not from guesswork: this file
 * previously modelled each field as a list of CANDIDATE names because the backend's
 * OpenAPI schema documents the 200 payload as "No response body". The contract supplies
 * the real payload, so the candidates are gone and every field below is the exact name
 * the API sends.
 *
 * Fields are still typed permissively in two specific ways, both deliberate:
 *   - Money and ids accept `string` as well as `number`, because Django REST serialises
 *     `Decimal` columns as strings by default and the contract's examples (`3498.0`) do
 *     not prove which the deployment emits. The mapper coerces; nothing is invented.
 *   - Every nullable field in the contract is `| null`, and optional on top of that, so a
 *     field the deployment omits entirely degrades to "not shown" rather than "undefined".
 *
 * DEPLOYMENT NOTE (verified 2026-10-03 against https://api.panchvastra.com):
 *   `GET/PUT /v1/orders/` exist (401 unauthenticated). `/v1/orders/notes/`,
 *   `/v1/orders/address/` and `/v1/orders/invoice/` all return 404, and the live
 *   `OrderStatusEnum` is PLACED/CONFIRMED/PACKED/SHIPPED/OUT_FOR_DELIVERY/DELIVERED/
 *   CANCELLED — i.e. that host is running a build older than this contract. The contract
 *   is the spec of record and is implemented as written; no workaround is coded for the
 *   older deployment.
 */

/* ------------------------------------------------------------------ vocabularies */

/**
 * The six statuses from the contract. The first five are the timeline, in order.
 *
 * This list exists ONLY to populate the admin's status <select>. Display text always
 * comes from the response's own `status_label` / `timeline[].label` — never from here.
 */
export const ORDER_STATUS_VALUES = [
  'PLACED',
  'PROCESSING',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
] as const

export type OrderStatusValue = (typeof ORDER_STATUS_VALUES)[number]

/** Statuses after which `PUT /v1/orders/address/` returns 400, per the contract. */
export const ADDRESS_LOCKED_STATUSES: readonly string[] = ['DELIVERED', 'CANCELLED']

/** `payment_status`. Note there is no `PAID` value — `SUCCESS` is displayed as "Paid". */
export const PAYMENT_STATUS_VALUES = ['PENDING', 'SUCCESS', 'FAILED'] as const

/** `payment_method`. The instrument (UPI/card/…) is not stored, so RAZORPAY reads "Online". */
export const PAYMENT_METHOD_VALUES = ['RAZORPAY', 'COD'] as const

/* ------------------------------------------------------------------ response DTOs */

/** One line item. Identical shape on the list and the detail response. */
export interface OrderItemDto {
  id?: number | string | null
  product_id?: number | string | null
  variant_id?: number | string | null
  product_name?: string | null
  color?: string | null
  size?: string | null
  quantity?: number | string | null
  mrp?: number | string | null
  selling_price?: number | string | null
  total_amount?: number | string | null
  sku?: string | null
  image_url?: string | null
}

/**
 * One node of the progress bar.
 *
 * The array is NOT a fixed length: a cancelled order returns only the steps it reached
 * plus a CANCELLED step. `completed` is the only thing that decides a node's state.
 */
export interface OrderTimelineStepDto {
  status?: string | null
  label?: string | null
  at?: string | null
  completed?: boolean | null
}

/** One entry of the detail screen's "Order Timeline" side panel. Not the progress bar. */
export interface OrderStatusHistoryDto {
  id?: number | string | null
  order_status?: string | null
  label?: string | null
  note?: string | null
  created_at?: string | null
  created_by?: string | null
}

/** One internal note. Always `[]` for a customer token — the panel is admin-only. */
export interface OrderNoteDto {
  id?: number | string | null
  order_id?: number | string | null
  note?: string | null
  created_at?: string | null
  created_by?: string | null
}

/** The order's shipping address. `customer_email` is present but NOT editable. */
export interface OrderAddressDto {
  customer_name?: string | null
  customer_email?: string | null
  customer_mobile?: string | null
  address_line_1?: string | null
  address_line_2?: string | null
  landmark?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  pincode?: string | null
}

/** Detail-only money breakdown. `discount_amount` is POSITIVE and displayed as "- ₹499". */
export interface OrderPriceSummaryDto {
  subtotal?: number | string | null
  discount_amount?: number | string | null
  shipping_amount?: number | string | null
  tax_amount?: number | string | null
  grand_total?: number | string | null
}

/** An order as returned by the list endpoint. */
export interface OrderDto {
  id?: number | string | null
  user_id?: number | string | null
  order_number?: string | null
  customer_name?: string | null
  customer_email?: string | null
  customer_mobile?: string | null
  order_status?: string | null
  status_label?: string | null
  payment_status?: string | null
  payment_method?: string | null
  grand_total?: number | string | null
  total_items?: number | string | null
  expected_delivery_date?: string | null
  ordered_at?: string | null
  processing_at?: string | null
  shipped_at?: string | null
  out_for_delivery_at?: string | null
  delivered_at?: string | null
  cancelled_at?: string | null
  tracking_id?: string | null
  courier_name?: string | null
  timeline?: OrderTimelineStepDto[] | null
  items?: OrderItemDto[] | null
}

/** An order as returned by `?id=`, by `PUT /v1/orders/` and by `PUT /v1/orders/address/`. */
export interface OrderDetailDto extends OrderDto {
  status_history?: OrderStatusHistoryDto[] | null
  notes?: OrderNoteDto[] | null
  transaction_id?: string | null
  paid_at?: string | null
  address?: OrderAddressDto | null
  price_summary?: OrderPriceSummaryDto | null
}

/** The `pagination` block that sits beside `data` in the envelope. */
export interface OrderPaginationDto {
  page?: number | string | null
  page_size?: number | string | null
  total_records?: number | string | null
  total_pages?: number | string | null
  has_next?: boolean | null
  has_previous?: boolean | null
}

/* ------------------------------------------------------------------ request DTOs */

/** Query parameters for `GET /v1/orders/`. */
export interface OrderQuery {
  /** When present the endpoint returns a single order detail instead of a list. */
  id?: number | string
  /** `current` = placed→out for delivery, `history` = delivered/cancelled. Omit for all. */
  order_type?: 'current' | 'history'
  page?: number
  page_size?: number
  /** ADMIN ONLY — matches order number, customer name or email. */
  search_parameter?: string
}

/**
 * Body for `PUT /v1/orders/` (admin).
 *
 * Only `id` and `order_status` are required. Milestone timestamps (`shipped_at` etc.) are
 * stamped server-side on first arrival at a status and are never sent from here.
 */
export interface UpdateOrderStatusDto {
  id: number | string
  order_status: string
  tracking_id?: string
  courier_name?: string
  /** `YYYY-MM-DD`. This is the only way to set or revise the "Expected by" date. */
  expected_delivery_date?: string
  /** Free text attached to this transition; surfaces in `status_history`. */
  note?: string
}

/** Body for `POST /v1/orders/notes/` (admin). */
export interface CreateOrderNoteDto {
  order_id: number | string
  note: string
}

/**
 * Body for `PUT /v1/orders/address/` (admin).
 *
 * `id` is the ORDER id. Only changed fields are sent; omitted fields keep their values,
 * and sending none of them is a 400. `customer_email` is intentionally absent — the
 * contract states it is not editable.
 */
export interface UpdateOrderAddressDto {
  id: number | string
  customer_name?: string
  customer_mobile?: string
  address_line_1?: string
  address_line_2?: string
  landmark?: string
  city?: string
  state?: string
  country?: string
  pincode?: string
}

/** The address fields the edit form may send, in display order. */
export const EDITABLE_ADDRESS_FIELDS = [
  'customer_name',
  'customer_mobile',
  'address_line_1',
  'address_line_2',
  'landmark',
  'city',
  'state',
  'country',
  'pincode',
] as const

export type EditableAddressField = (typeof EDITABLE_ADDRESS_FIELDS)[number]
