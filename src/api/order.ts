import api from './axios'
import { adminAuthConfig, MissingAdminSessionError } from './adminRequest'
import { mapNote, mapOrderDetail, mapOrderSummary, mapPagination } from '@/mappers/orderMapper'
import type {
  CreateOrderNoteDto,
  OrderDetailDto,
  OrderDto,
  OrderNoteDto,
  OrderPaginationDto,
  OrderQuery,
  UpdateOrderAddressDto,
  UpdateOrderStatusDto,
} from '@/types/api/OrderDto'
import type { OrderDetail, OrderListResult, OrderNote } from '@/types/orderManagement'

export { MissingAdminSessionError }

/**
 * Order management service — every `/v1/orders/...` call the three screens make.
 *
 * AUTHORIZATION. Two distinct paths, and they never mix:
 *   - Customer reads go through the shared `api` client, which attaches the signed-in
 *     shopper's token. The backend decides what that token may see.
 *   - Admin calls pass `adminAuthConfig()` explicitly. It reads the admin session key and
 *     THROWS before any request when there isn't one, so an admin endpoint can never be
 *     reached with a shopper's token and never silently falls back to one.
 * No endpoint is "reused" across roles to sidestep that split: the admin list and the
 * customer list hit the same URL through two separate functions with two separate configs.
 *
 * DEPLOYMENT NOTE (verified 2026-10-03 against https://api.panchvastra.com): only
 * `GET`/`PUT /v1/orders/` are live there. `/v1/orders/notes/`, `/v1/orders/address/` and
 * `/v1/orders/invoice/` currently return 404 on that host, so the features built on them
 * will surface the API's own error until the deployment catches up with this contract.
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
  if (error instanceof MissingAdminSessionError) return error.message

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

/** Kept as a distinct name so admin call sites read clearly; same safety rules apply. */
export const readAdminOrderApiError = readOrderApiError

/* ------------------------------------------------------------------ query */

/** Drops empty values so only parameters the caller actually set reach the wire. */
function toParams(query: OrderQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {}
  if (query.id !== undefined && query.id !== '') params.id = query.id
  if (query.order_type) params.order_type = query.order_type
  if (query.page !== undefined) params.page = query.page
  if (query.page_size !== undefined) params.page_size = query.page_size
  if (query.search_parameter?.trim()) params.search_parameter = query.search_parameter.trim()
  return params
}

/** Shared list-response reading, so both roles interpret the envelope identically. */
function readListResponse(
  body: OrderEnvelope<OrderDto[]> | undefined,
  requestedPage: number,
): OrderListResult {
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
  const response = await api.get<OrderEnvelope<OrderDto[]>>('/v1/orders/', { params: toParams(query) })
  return readListResponse(response.data, query.page ?? 1)
}

/* ------------------------------------------------------------------ admin: read */

/**
 * `GET /v1/orders/` as an ADMIN — orders across every customer.
 *
 * Same URL as `getOrders`, different token. `search_parameter` is admin-only and is only
 * ever sent from here.
 */
export async function getAdminOrders(query: OrderQuery = {}): Promise<OrderListResult> {
  const response = await api.get<OrderEnvelope<OrderDto[]>>('/v1/orders/', {
    ...adminAuthConfig(),
    params: toParams(query),
  })
  return readListResponse(response.data, query.page ?? 1)
}

/** `GET /v1/orders/?id={id}` as an ADMIN — one order, with history, notes and address. */
export async function getAdminOrderDetail(id: number | string): Promise<OrderDetail | null> {
  const response = await api.get<OrderEnvelope<OrderDetailDto>>('/v1/orders/', {
    ...adminAuthConfig(),
    params: { id },
  })
  const data = response.data?.data
  // An `?id=` read returns a single object. An array (or nothing) means the backend did
  // not resolve the order, which is reported as "not found" rather than guessed at.
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return mapOrderDetail(data)
}

/* ------------------------------------------------------------------ admin: write */

/**
 * `PUT /v1/orders/` — update status (admin only).
 *
 * Sends only the contract's own fields. Milestone timestamps are stamped server-side on
 * first arrival at a status and are never sent from here. The response IS the updated
 * detail, so callers re-render from it instead of issuing a second read.
 */
export async function updateOrderStatus(payload: UpdateOrderStatusDto): Promise<OrderDetail | null> {
  const body: UpdateOrderStatusDto = { id: payload.id, order_status: payload.order_status }
  if (payload.tracking_id !== undefined) body.tracking_id = payload.tracking_id
  if (payload.courier_name !== undefined) body.courier_name = payload.courier_name
  if (payload.expected_delivery_date !== undefined) body.expected_delivery_date = payload.expected_delivery_date
  if (payload.note !== undefined) body.note = payload.note

  const response = await api.put<OrderEnvelope<OrderDetailDto>>('/v1/orders/', body, adminAuthConfig())
  const data = response.data?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return mapOrderDetail(data)
}

/**
 * `POST /v1/orders/notes/` — add an internal note (admin only).
 *
 * Returns 201 with the created note, which the caller appends to the panel directly.
 */
export async function addOrderNote(payload: CreateOrderNoteDto): Promise<OrderNote | null> {
  const body: CreateOrderNoteDto = { order_id: payload.order_id, note: payload.note }
  const response = await api.post<OrderEnvelope<OrderNoteDto>>('/v1/orders/notes/', body, adminAuthConfig())
  const data = response.data?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return mapNote(data)
}

/** `DELETE /v1/orders/notes/?id={note_id}` — soft delete (admin only). */
export async function deleteOrderNote(noteId: number | string): Promise<void> {
  await api.delete<OrderEnvelope<unknown>>('/v1/orders/notes/', {
    ...adminAuthConfig(),
    params: { id: noteId },
  })
}

/**
 * `PUT /v1/orders/address/` — edit this order's shipping address (admin only).
 *
 * `id` is the ORDER id. Only changed fields are sent; the backend keeps omitted ones.
 * `customer_email` is never sent because the contract states it is not editable.
 * Returns the full updated order detail.
 */
export async function updateOrderAddress(payload: UpdateOrderAddressDto): Promise<OrderDetail | null> {
  const response = await api.put<OrderEnvelope<OrderDetailDto>>('/v1/orders/address/', payload, adminAuthConfig())
  const data = response.data?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return mapOrderDetail(data)
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
 * `asAdmin` selects which credential signs the request — it does NOT widen access. The
 * backend still enforces that a customer may only download their own invoice.
 */
export async function downloadOrderInvoice(
  orderId: number | string,
  orderNumber: string,
  { asAdmin = false }: { asAdmin?: boolean } = {},
): Promise<void> {
  const config = asAdmin ? adminAuthConfig() : {}

  let blob: Blob
  try {
    const response = await api.get<Blob>('/v1/orders/invoice/', {
      ...config,
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
  if (error instanceof MissingAdminSessionError) return error

  const response = (error as { response?: { status?: number; data?: unknown } }).response
  if (response?.data instanceof Blob) {
    const message = await readBlobMessage(response.data)
    return new Error(
      readOrderApiError({ response: { status: response.status, data: { message } } }, 'Unable to download this invoice.'),
    )
  }

  return new Error(readOrderApiError(error, 'Unable to download this invoice.'))
}
