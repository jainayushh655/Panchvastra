import api from './axios'
import { mapOrder, readOrderList, readPageInfo } from '@/mappers/orderMapper'
import type { OrderQuery } from '@/types/api/OrderDto'
import type { CustomerOrder, CustomerOrderPage } from '@/types/customerOrder'

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
  if (query.page !== undefined) params.page = query.page
  if (query.page_size !== undefined) params.page_size = query.page_size
  if (query.status) params.status = query.status
  return params
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
