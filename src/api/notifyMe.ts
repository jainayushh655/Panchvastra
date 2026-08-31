import api from './axios'
import type { NotifyMeCreateDto, NotifyMeQuery, NotifyMeSubscriptionDto } from '@/types/api/NotifyMeDto'

/**
 * Notify-Me (restock subscription) API.
 *
 * VERIFIED LIVE against /v1/notify_me/ — unlike most of this backend, these routes are
 * NOT authentication-gated: unauthenticated calls return validation errors, not 401.
 *
 *   POST with no body      → 400 {"success":false,"message":{"variant_size_id":["This field
 *                                 is required."],"email":["This field is required."]},"data":{}}
 *   POST bad email         → 400 {"success":false,"message":{"email":["Enter a valid email
 *                                 address."]},"data":{}}
 *   POST unknown size id   → 404 {"success":false,"message":"Product size not found.","data":{}}
 *   POST in-stock size id  → 400 {"success":false,"message":"This size is already in stock.","data":{}}
 *   DELETE with no params  → 400 {"success":false,"message":"id and email are required.","data":{}}
 *   GET                    → 500 — the backend table is missing:
 *                            relation "notify_me_requests" does not exist
 *
 * So the POST request contract is confirmed exactly (`variant_size_id` + `email`), and the
 * backend itself enforces that a size must be genuinely out of stock. What could NOT be
 * observed is any 2xx payload: GET is broken server-side, and at the time of writing every
 * size in the live catalogue is in stock, so POST cannot reach its success path. Response
 * reading is therefore defensive over this backend's confirmed `{ success, message, data }`
 * envelope.
 *
 * Base URL, interceptors and the auth header (sent when a session exists, though these
 * routes do not require it) all come from the shared `api` client — no new HTTP layer.
 */

type NotifyEnvelope<T> = {
  success?: boolean
  message?: string | Record<string, string[]>
  data?: T
}

/** Flattens this backend's two `message` shapes (string, or field→messages) into one line. */
export function readNotifyApiMessage(message: unknown, fallback: string): string {
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

/**
 * Turns any thrown request error into a user-safe message (never a raw stack or the
 * backend's SQL/`error` field). Where the backend supplies a meaningful validation message
 * of its own — "This size is already in stock.", "Product size not found." — that message
 * is shown rather than a generic one.
 */
export function readNotifyApiError(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: NotifyEnvelope<unknown> } }).response

  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const status = response.status
  if (status === 401 || status === 403) return 'Your session has expired. Please sign in again.'
  if (status === 409) return "You're already subscribed for this size."
  if (status === 429) return 'Too many requests. Please try again in a moment.'
  // 5xx bodies carry the raw DB/exception text in an `error` field — never surface it.
  if (status && status >= 500) return 'The server is temporarily unavailable. Please try again shortly.'

  return readNotifyApiMessage(response.data?.message, fallback)
}

function readList(data: unknown): NotifyMeSubscriptionDto[] {
  if (Array.isArray(data)) return data as NotifyMeSubscriptionDto[]
  if (data && typeof data === 'object') {
    for (const key of ['results', 'subscriptions', 'data']) {
      const value = (data as Record<string, unknown>)[key]
      if (Array.isArray(value)) return value as NotifyMeSubscriptionDto[]
    }
    for (const value of Object.values(data as Record<string, unknown>)) {
      if (Array.isArray(value)) return value as NotifyMeSubscriptionDto[]
    }
  }
  return []
}

/**
 * GET /v1/notify_me/ — pending subscriptions, optionally filtered by `variant_size_id`.
 *
 * Not called by the Notify Me flow: there is no cancellation UI to list, the backend
 * decides duplicates on POST, and this endpoint currently returns 500. Exposed at the
 * service level for the documented parameters, with no polling anywhere.
 */
export async function getNotifySubscriptions(query: NotifyMeQuery = {}): Promise<NotifyMeSubscriptionDto[]> {
  const params: Record<string, number> = {}
  if (query.page !== undefined) params.page = query.page
  if (query.page_size !== undefined) params.page_size = query.page_size
  if (query.variant_size_id !== undefined) params.variant_size_id = query.variant_size_id

  const response = await api.get<NotifyEnvelope<unknown>>('/v1/notify_me/', { params })
  return readList(response.data?.data)
}

/**
 * POST /v1/notify_me/ — subscribes `email` to the restock of one variant size.
 *
 * `variantSizeId` must be the backend's own `VariantSizeDto.id`; nothing is derived from
 * size names or array positions. Exactly one size per call.
 */
export async function createNotifySubscription(variantSizeId: number, email: string): Promise<void> {
  const payload: NotifyMeCreateDto = { variant_size_id: variantSizeId, email: email.trim() }
  await api.post<NotifyEnvelope<unknown>>('/v1/notify_me/', payload)
}

/**
 * DELETE /v1/notify_me/?email=<email>&id=<subscriptionId>.
 *
 * `subscriptionId` is the notify-me subscription's own id from GET — never a product,
 * variant or variant-size id. No cancellation UI exists today, so this is service-level
 * only; it cancels a subscription and nothing else.
 */
export async function deleteNotifySubscription(subscriptionId: number | string, email: string): Promise<void> {
  await api.delete<NotifyEnvelope<unknown>>('/v1/notify_me/', {
    params: { email: email.trim(), id: subscriptionId },
  })
}
