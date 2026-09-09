import api from './axios'
import { adminAuthConfig, MissingAdminSessionError } from './adminRequest'
import { mapOrder, readOrderList, readPageInfo } from '@/mappers/orderMapper'
import type { OrderQuery, UpdateOrderStatusDto } from '@/types/api/OrderDto'
import type { CustomerOrder, CustomerOrderPage } from '@/types/customerOrder'

export { MissingAdminSessionError }

/**
 * Order History API.
 *
 * VERIFIED LIVE against /v1/orders/:
 *   - The endpoint exists and is authentication-gated: an unauthenticated GET returns
 *     401 {"success": false, "message": "Authorization token missing.", "data": {}}
 *     (a request to a non-existent path returns 404, so 401 confirms the route is real).
 *   - The backend's published OpenAPI schema (GET /api/schema/) defines a single GET
 *     operation on this path, accepting exactly `id`, `page`, `page_size` and `status`.
 *     Nothing outside that set is ever sent.
 *
 * NOT VERIFIED: the 200 payload — the schema documents it as "No response body" and no
 * authenticated session was obtainable here. Response reading is therefore delegated to
 * `orderMapper`, which resolves each field from documented candidates over this backend's
 * confirmed `{ success, message, data }` envelope and leaves unmatched fields empty.
 *
 * Auth headers, base URL and interceptors all come from the shared `api` client — no new
 * HTTP layer, no separate token, no hardcoded base URL.
 */

type OrderEnvelope = {
  success?: boolean
  message?: string | Record<string, string[]>
  data?: unknown
}

/** Flattens this backend's two `message` shapes (string, or field→messages) into one line. */
export function readOrderApiMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim()) return message
  if (message && typeof message === 'object') {
    const parts: string[] = []
    for (const value of Object.values(message as Record<string, unknown>)) {
      if (Array.isArray(value)) parts.push(...value.filter((v): v is string => typeof v === 'string'))
      else if (typeof value === 'string') parts.push(value)
    }
    if (parts.length) return parts.join(' ')
  }
  return fallback
}

/** Turns any thrown request error into a user-safe message (never a raw stack/trace). */
export function readOrderApiError(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: OrderEnvelope } }).response

  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const status = response.status
  if (status === 401 || status === 403) return 'Your session has expired. Please sign in again.'
  if (status === 404) return 'That order could not be found.'
  if (status && status >= 500) return 'The server is temporarily unavailable. Please try again shortly.'

  return readOrderApiMessage(response.data?.message, fallback)
}

/** Drops empty values so only parameters the caller actually set are sent. */
function toParams(query: OrderQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {}
  if (query.id !== undefined && query.id !== '') params.id = query.id
  if (query.order_type) params.order_type = query.order_type
  if (query.page !== undefined) params.page = query.page
  if (query.page_size !== undefined) params.page_size = query.page_size
  if (query.search_parameter?.trim()) params.search_parameter = query.search_parameter.trim()
  return params
}

/** Turns a thrown request error into a message safe to show an admin. */
export function readAdminOrderApiError(error: unknown, fallback: string): string {
  if (error instanceof MissingAdminSessionError) return error.message

  const response = (error as { response?: { status?: number; data?: OrderEnvelope } }).response
  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const status = response.status
  if (status === 401) return 'Your admin session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to manage orders.'
  if (status === 404) return 'That order could not be found.'
  if (status === 429) return 'Too many requests. Please try again in a moment.'
  // 5xx bodies can carry raw DB/exception text — never surface it.
  if (status && status >= 500) return 'The server is temporarily unavailable. Please try again shortly.'

  return readOrderApiMessage(response.data?.message, fallback)
}

/**
 * GET /v1/orders/ — the authenticated user's orders.
 *
 * Pass `page`/`page_size` to paginate or `status` to filter server-side; omitting them
 * sends a bare GET /v1/orders/.
 */
export async function getOrders(query: OrderQuery = {}): Promise<CustomerOrderPage> {
  const response = await api.get<OrderEnvelope>('/v1/orders/', { params: toParams(query) })

  // Pagination metadata may sit alongside the list in `data`, or at the response root.
  const payload = response.data?.data ?? response.data
  const orders = readOrderList(payload).map((dto, index) => mapOrder(dto, index))
  const pageInfo = readPageInfo(payload, query.page ?? 1)

  return { orders, pageInfo }
}

/**
 * GET /v1/orders/?id=<id> — a single order.
 *
 * Exposed at the service level for the documented `id` parameter. The Orders page has no
 * order-detail interaction today, so no route or navigation was added for it.
 */
export async function getOrderById(id: number | string): Promise<CustomerOrder | null> {
  const response = await api.get<OrderEnvelope>('/v1/orders/', { params: { id } })
  const payload = response.data?.data ?? response.data
  const [order] = readOrderList(payload).map((dto, index) => mapOrder(dto, index))
  return order ?? null
}

/* ------------------------------------------------------------------ admin (orders) */

/**
 * GET /v1/orders/ as an ADMIN — orders across every customer.
 *
 * Same endpoint and same mapper as the customer read; the only difference is the token.
 * The admin token is passed explicitly through the shared `adminAuthConfig` helper (the
 * one Categories, Products, Coupons and Auth Carousel already use), so this call fails
 * closed without an admin session and never silently falls back to a shopper's token.
 * `getOrders` above is deliberately untouched.
 */
export async function getAdminOrders(query: OrderQuery = {}): Promise<CustomerOrderPage> {
  const config = adminAuthConfig()
  const response = await api.get<OrderEnvelope>('/v1/orders/', {
    ...config,
    params: toParams(query),
  })

  const root = (response.data ?? {}) as Record<string, unknown>
  const payload = root.data ?? root
  const orders = readOrderList(payload).map((dto, index) => mapOrder(dto, index))

  /*
   * Where the pagination block lives.
   *
   * This backend's CONFIRMED convention (categories_management, sub_categories_management,
   * products_management) is a `pagination` object at the response ROOT, beside `data` — so
   * that is preferred. A block nested inside the payload, and DRF's own `next`/`count` on
   * the payload itself, are both still accepted. `readPageInfo` reports a further page only
   * when one of these actually says so, so an unrecognised shape simply yields no paging
   * controls rather than an invented page count.
   */
  const nested =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).pagination
      : undefined
  const paginationSource = root.pagination ?? nested ?? payload
  const pageInfo = readPageInfo(paginationSource, query.page ?? 1)

  return { orders, pageInfo }
}

/**
 * PUT /v1/orders/ — admin only, updates an order's status.
 *
 * Sends ONLY the fields the published `UpdateOrderStatusRequest` defines: `id` and
 * `order_status` always, plus `tracking_id` / `courier_name` when the caller supplies
 * them. No customer, product, amount, address, payment or timestamp field is ever sent —
 * the backend stamps shipped_at / delivered_at / cancelled_at itself.
 */
export async function updateOrderStatus(payload: UpdateOrderStatusDto) {
  const body: UpdateOrderStatusDto = { id: payload.id, order_status: payload.order_status }
  if (payload.tracking_id !== undefined) body.tracking_id = payload.tracking_id
  if (payload.courier_name !== undefined) body.courier_name = payload.courier_name

  return api.put<OrderEnvelope>('/v1/orders/', body, adminAuthConfig())
}
