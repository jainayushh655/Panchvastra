import api from '@/services/http/client'
import { ENDPOINTS } from '@/services/endpoints'
import { mapOrderSummary, mapPagination } from '@/mappers/orderMapper'
import type { OrderDto, OrderPaginationDto, OrderQuery } from '@/types/api/OrderDto'
import type { OrderListResult } from '@/types/orderManagement'

/**
 * Orders — the CUSTOMER half of the Vite `src/api/order.ts`.
 *
 * The admin reads and writes (order status, notes, address edits, the cross-customer
 * list) are deliberately NOT here: they are a different role against the same URL, they
 * need the admin credential, and they belong with the admin panel in Phase 5. Porting
 * them now would put admin surface in a storefront bundle and carry the
 * `adminAuthConfig` dependency with it.
 *
 * What IS here is byte-identical in contract to the Vite original: the same envelope
 * reading, the same parameter whitelist, the same error rules, and the same blob-mode
 * invoice download.
 *
 * ⚠️ DEPLOYMENT NOTE carried over from the Vite module (verified 2026-10-03 against the
 * live host): only `GET`/`PUT /v1/orders/` are live there. `/v1/orders/invoice/` returns
 * 404, so the invoice button will surface the API's own error until the deployment
 * catches up with the contract. That is the backend's state, not a migration gap.
 */

type OrderEnvelope<T> = {
  success?: boolean
  message?: unknown
  data?: T
  pagination?: OrderPaginationDto | null
}

/* ------------------------------------------------------------------ messages */

/** Flattens the two `message` shapes this backend uses (a string, or field→messages). */
export function readOrderApiMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim()) return message.trim()

  if (message && typeof message === 'object') {
    const parts: string[] = []
    for (const value of Object.values(message as Record<string, unknown>)) {
      if (Array.isArray(value)) parts.push(...value.filter((entry): entry is string => typeof entry === 'string'))
      else if (typeof value === 'string') parts.push(value)
    }
    if (parts.length) return parts.join(' ')
  }

  return fallback
}

/**
 * Turns a thrown request error into a message that is safe to put on screen.
 *
 * The contract states `message` is written for end users, so a 4xx body is surfaced
 * verbatim. A 5xx body is NOT: those can carry a Django debug page or raw SQL, so they
 * are replaced with a generic line. Nothing here logs or echoes the bearer token.
 */
export function readOrderApiError(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: OrderEnvelope<unknown> } }).response
  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const status = response.status
  if (status && status >= 500) return 'The server is temporarily unavailable. Please try again shortly.'

  const message = readOrderApiMessage(response.data?.message, '')
  if (message) return message

  if (status === 401) return 'Your session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to do that.'
  if (status === 404) return 'That order could not be found.'
  if (status === 429) return 'Too many requests. Please try again in a moment.'

  return fallback
}

/* ------------------------------------------------------------------ query */

/** Drops empty values so only parameters the caller actually set reach the wire. */
function toParams(query: OrderQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {}
  if (query.id !== undefined && query.id !== '') params.id = query.id
  if (query.order_type) params.order_type = query.order_type
  if (query.page !== undefined) params.page = query.page
  if (query.page_size !== undefined) params.page_size = query.page_size
  /*
   * `search_parameter` is ADMIN-ONLY and the orders screen never sends it. It stays in
   * this whitelist because the whitelist is what keeps anything NOT listed off the wire;
   * removing it would not stop a caller passing it, it would only make the omission
   * silent.
   */
  if (query.search_parameter?.trim()) params.search_parameter = query.search_parameter.trim()
  return params
}

/** Shared list-response reading, so the list and its paging are interpreted in one place. */
function readListResponse(body: OrderEnvelope<OrderDto[]> | undefined, requestedPage: number): OrderListResult {
  const data = Array.isArray(body?.data) ? body.data : []
  return {
    orders: data.map((dto, index) => mapOrderSummary(dto, index)),
    pagination: mapPagination(body?.pagination, requestedPage),
    // The contract's empty state uses the envelope's own wording ("Data not found.").
    message: readOrderApiMessage(body?.message, ''),
  }
}

/* ------------------------------------------------------------------ customer */

/** `GET /v1/orders/` — the signed-in customer's own orders. */
export async function getOrders(query: OrderQuery = {}): Promise<OrderListResult> {
  const response = await api.get<OrderEnvelope<OrderDto[]>>(ENDPOINTS.orders, { params: toParams(query) })
  return readListResponse(response.data, query.page ?? 1)
}

/* ------------------------------------------------------------------ invoice */

/**
 * `GET /v1/orders/invoice/?id={id}` — downloads the invoice PDF.
 *
 * The endpoint returns a PDF binary and requires an Authorization header, so a plain
 * `<a href>` cannot be used: the file is fetched as a blob and handed to a temporary
 * object URL. An error still comes back as JSON, which arrives here as a Blob, so the
 * body is read back as text and its `message` thrown for the caller to display.
 *
 * The backend enforces that a customer may only download their own invoice.
 */
export async function downloadOrderInvoice(orderId: number | string, orderNumber: string): Promise<void> {
  let blob: Blob
  try {
    const response = await api.get<Blob>(ENDPOINTS.orderInvoice, {
      params: { id: orderId },
      responseType: 'blob',
    })
    blob = response.data
  } catch (error) {
    throw await toInvoiceError(error)
  }

  // A JSON body that arrived with a 2xx is an error the server did not flag as one;
  // saving it would hand the user a .pdf that is actually an error message.
  if (blob.type && blob.type.includes('json')) {
    throw new Error(readOrderApiMessage(await readBlobMessage(blob), 'Unable to download this invoice.'))
  }

  const href = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = href
    link.download = `invoice-${orderNumber || orderId}.pdf`
    link.click()
  } finally {
    URL.revokeObjectURL(href)
  }
}

/** Reads the `message` out of an error body that was received as a Blob. */
async function readBlobMessage(blob: Blob): Promise<unknown> {
  try {
    return JSON.parse(await blob.text())?.message
  } catch {
    return undefined
  }
}

/**
 * Rebuilds a blob-mode failure into a normal error.
 *
 * With `responseType: 'blob'` axios gives the error body as a Blob, so the usual
 * `response.data.message` read finds nothing. The body is decoded first and then run
 * through the same `readOrderApiError` rules, including the 5xx guard.
 */
async function toInvoiceError(error: unknown): Promise<Error> {
  const response = (error as { response?: { status?: number; data?: unknown } }).response
  if (response?.data instanceof Blob) {
    const message = await readBlobMessage(response.data)
    return new Error(
      readOrderApiError(
        { response: { status: response.status, data: { message } } },
        'Unable to download this invoice.',
      ),
    )
  }

  return new Error(readOrderApiError(error, 'Unable to download this invoice.'))
}
