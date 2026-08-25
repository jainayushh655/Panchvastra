/**
 * Order History contract for GET /v1/orders/.
 *
 * VERIFIED from the backend's published OpenAPI schema (GET /api/schema/):
 *   - The path exists with a single GET operation ("Retrieve orders", tag "Order History").
 *   - It accepts exactly four query parameters: `id` (integer), `page` (integer),
 *     `page_size` (integer) and `status` (string). No others are sent.
 *   - BearerAuth.
 *
 * NOT VERIFIED: the 200 payload. The schema documents the response as "No response body",
 * and no authenticated session could be established from this environment (login requires
 * an OTP emailed to a real account), so the field names below could not be observed.
 *
 * They are therefore modelled as OPTIONAL candidates drawn from this backend's own
 * confirmed conventions rather than guessed in a vacuum — the cart contract
 * (`CartItemDto`, a real observed response) uses `product_id`, `product_name`, `size`,
 * `color`, `quantity`, `selling_price`, `mrp` and `primary_image`, and orders are created
 * from carts. The mapper reads each logical field from a documented candidate list and the
 * UI renders only what is actually present, so an unmatched field is simply omitted rather
 * than displayed as an invented value.
 */

/** A single line item on an order. Every field is optional because none is confirmed. */
export interface OrderItemDto {
  id?: number | string | null
  product_id?: number | string | null
  product_name?: string | null
  name?: string | null
  title?: string | null
  primary_image?: string | null
  image?: string | null
  image_url?: string | null
  product_image?: string | null
  size?: string | null
  color?: string | null
  quantity?: number | string | null
  qty?: number | string | null
  selling_price?: number | string | null
  price?: number | string | null
  unit_price?: number | string | null
  mrp?: number | string | null
  total_price?: number | string | null
  [key: string]: unknown
}

/** A single order record. */
export interface OrderDto {
  id?: number | string | null
  order_id?: number | string | null
  order_number?: string | null
  created_at?: string | null
  order_date?: string | null
  placed_at?: string | null
  date?: string | null
  status?: string | null
  order_status?: string | null
  total_amount?: number | string | null
  total_price?: number | string | null
  grand_total?: number | string | null
  final_amount?: number | string | null
  total?: number | string | null
  amount?: number | string | null
  items?: OrderItemDto[] | null
  order_items?: OrderItemDto[] | null
  products?: OrderItemDto[] | null
  [key: string]: unknown
}

/** Query parameters accepted by GET /v1/orders/, per the published schema. */
export interface OrderQuery {
  id?: number | string
  page?: number
  page_size?: number
  status?: string
}
