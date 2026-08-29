import api from './axios'
import { adminAuthConfig, MissingAdminSessionError } from './adminRequest'
import { formatInr } from '@/lib/format'
import type { CouponCreateDto, CouponDto, CouponUpdateDto } from '@/types/api/CouponDto'

/**
 * Coupon Management API.
 *
 * VERIFIED LIVE against /v1/coupon_management/: GET, POST, PUT and DELETE all exist and
 * all four require authentication — unauthenticated calls return
 * 401 {"success": false, "message": "Authorization token missing.", "data": {}}
 * (a non-existent path returns 404, so 401 confirms the routes are real).
 *
 * VERIFIED from the backend's published OpenAPI schema (GET /api/schema/):
 *   - GET accepts `code` (case-insensitive) and `id`; it "returns all active coupons or
 *     fetches a specific coupon". It is a RETRIEVAL endpoint — it takes no cart, no order
 *     and no user context, so it cannot answer "is this coupon valid for this order".
 *   - POST body `CouponRequest`; PUT body `UpdateCouponRequest` (same fields plus `id`).
 *     Required: code, discount_type, discount_value, start_date, end_date.
 *   - DELETE takes `id` and performs a SOFT delete (marks inactive/deleted).
 *
 * NOT VERIFIED: any 2xx payload — the schema documents every response as "No response
 * body" and no admin session could be established here. Reads follow this backend's
 * confirmed `{ success, message, data }` envelope and degrade to empty rather than throw.
 *
 * ADMIN vs CUSTOMER: the CRUD calls below are admin-only and send the admin token
 * explicitly. Customer-facing code must use `lookupCouponByCode`, which carries only the
 * signed-in customer's own token via the shared interceptor. The two never mix.
 */

type CouponEnvelope<T> = {
  success?: boolean
  message?: string | Record<string, string[]>
  data?: T
}

export { MissingAdminSessionError }

/** Flattens this backend's two `message` shapes (string, or field→messages) into one line. */
export function readCouponApiMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim()) return message
  if (message && typeof message === 'object') {
    const parts: string[] = []
    for (const [field, value] of Object.entries(message as Record<string, unknown>)) {
      const texts = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string')
        : typeof value === 'string'
          ? [value]
          : []
      for (const text of texts) parts.push(field === 'detail' ? text : `${field}: ${text}`)
    }
    if (parts.length) return parts.join(' ')
  }
  return fallback
}

/** Turns any thrown request error into a safe message (never a raw stack/SQL/exception). */
export function readCouponApiError(error: unknown, fallback: string): string {
  if (error instanceof MissingAdminSessionError) return error.message

  const response = (error as { response?: { status?: number; data?: CouponEnvelope<unknown> } }).response
  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const status = response.status
  if (status === 401) return 'Your admin session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to manage coupons.'
  if (status === 404) return 'That coupon could not be found.'
  if (status === 409) return 'A coupon with that code already exists.'
  if (status === 429) return 'Too many requests. Please try again in a moment.'
  // 5xx bodies can carry raw DB/exception text — never surface it.
  if (status && status >= 500) return 'The server is temporarily unavailable. Please try again shortly.'

  return readCouponApiMessage(response.data?.message, fallback)
}

function readList(data: unknown): CouponDto[] {
  if (Array.isArray(data)) return data as CouponDto[]
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>
    for (const key of ['results', 'coupons', 'data']) {
      if (Array.isArray(record[key])) return record[key] as CouponDto[]
    }
    // A single-coupon response (?code= / ?id=) is a bare object — check before the generic
    // array scan so a nested array on the record cannot be mistaken for the list.
    if ('id' in record || 'code' in record) return [record as CouponDto]
    for (const value of Object.values(record)) {
      if (Array.isArray(value)) return value as CouponDto[]
    }
  }
  return []
}

/* ------------------------------------------------------------------ admin (CRUD) */

/** GET /v1/coupon_management/ — all active coupons. Admin only. */
export async function getCoupons(): Promise<CouponDto[]> {
  const response = await api.get<CouponEnvelope<unknown>>('/v1/coupon_management/', adminAuthConfig())
  return readList(response.data?.data)
}

/** POST /v1/coupon_management/ — creates a coupon. Admin only. */
export async function createCoupon(payload: CouponCreateDto): Promise<void> {
  await api.post<CouponEnvelope<unknown>>('/v1/coupon_management/', payload, adminAuthConfig())
}

/** PUT /v1/coupon_management/ — updates a coupon; `id` identifies it. Admin only. */
export async function updateCoupon(payload: CouponUpdateDto): Promise<void> {
  await api.put<CouponEnvelope<unknown>>('/v1/coupon_management/', payload, adminAuthConfig())
}

/**
 * DELETE /v1/coupon_management/?id=<id> — admin only.
 *
 * The backend soft-deletes (marks the coupon inactive/deleted); there is deliberately no
 * frontend hard-delete, and nothing is removed from local state on the client's say-so —
 * callers re-fetch.
 */
export async function deleteCoupon(id: number | string): Promise<void> {
  const config = adminAuthConfig()
  await api.delete<CouponEnvelope<unknown>>('/v1/coupon_management/', { ...config, params: { id } })
}

/* --------------------------------------------------------------- customer (read) */

export type CouponLookup =
  | { ok: true; coupon: CouponDto }
  | { ok: false; message: string }

/** Message shown when the code itself is not a real coupon. */
export const INVALID_COUPON_MESSAGE = 'Invalid coupon code. Please check the code and try again.'

function toAmount(value: string | number | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

export type CouponEvaluation =
  | { ok: true; discountAmount: number }
  | { ok: false; message: string }

/**
 * Works out the coupon discount for the current order from the record the backend
 * returned, and reports the specific business reason when it does not apply.
 *
 * `orderAmount` is the subtotal AFTER product-level discounts — the coupon is an
 * additional reduction on top of that, and product discounts are never recomputed here.
 *
 * LIMITS THAT CANNOT BE CHECKED HERE: `max_usage`, `max_usage_per_user` and
 * `is_first_order_only` all depend on redemption history that GET /v1/coupon_management/
 * does not return, so they can only be enforced by the backend when the order is placed.
 */
export function evaluateCoupon(coupon: CouponDto, orderAmount: number): CouponEvaluation {
  if (coupon.is_active === false) {
    return { ok: false, message: 'This coupon is no longer active.' }
  }

  const now = Date.now()
  const start = coupon.start_date ? new Date(coupon.start_date).getTime() : NaN
  const end = coupon.end_date ? new Date(coupon.end_date).getTime() : NaN
  if (Number.isFinite(start) && now < start) {
    return { ok: false, message: 'This coupon is not active yet.' }
  }
  if (Number.isFinite(end) && now > end) {
    return { ok: false, message: 'This coupon has expired.' }
  }

  const minimum = toAmount(coupon.minimum_order_amount)
  if (minimum !== null && minimum > 0 && orderAmount < minimum) {
    return { ok: false, message: `Add items worth ${formatInr(minimum - orderAmount)} more to use this coupon.` }
  }

  const value = toAmount(coupon.discount_value)
  if (value === null || value <= 0) {
    return { ok: false, message: 'This coupon cannot be applied to your order.' }
  }

  const type = String(coupon.discount_type ?? '').toUpperCase()
  let discount: number
  if (type === 'PERCENTAGE') {
    discount = (orderAmount * value) / 100
    const cap = toAmount(coupon.maximum_discount_amount)
    if (cap !== null && cap > 0) discount = Math.min(discount, cap)
  } else if (type === 'FLAT') {
    discount = value
  } else {
    return { ok: false, message: 'This coupon cannot be applied to your order.' }
  }

  // Never discount below zero, and never touch the product-level discount.
  discount = Math.round(Math.min(discount, orderAmount))
  if (discount <= 0) {
    return { ok: false, message: 'This coupon cannot be applied to your order.' }
  }

  return { ok: true, discountAmount: discount }
}

/**
 * GET /v1/coupon_management/?code=<code> — looks up one coupon for the signed-in customer.
 *
 * Sends only the customer's own token (via the shared interceptor); no admin credential is
 * ever attached here. This confirms the code EXISTS and returns its configuration — it does
 * not, and cannot, confirm the coupon is redeemable for this order: the endpoint receives
 * no cart, no order and no per-user usage context, so `minimum_order_amount`,
 * `max_usage`, `max_usage_per_user` and `is_first_order_only` cannot be evaluated here.
 * The discount is therefore never computed on the client — see `CouponSection`.
 */
export async function lookupCouponByCode(code: string): Promise<CouponLookup> {
  const trimmed = code.trim()
  if (!trimmed) return { ok: false, message: 'Enter a coupon code.' }

  try {
    const response = await api.get<CouponEnvelope<unknown>>('/v1/coupon_management/', {
      params: { code: trimmed },
    })

    const [coupon] = readList(response.data?.data)
    if (!coupon) return { ok: false, message: INVALID_COUPON_MESSAGE }

    return { ok: true, coupon }
  } catch (error) {
    const response = (error as { response?: { status?: number; data?: CouponEnvelope<unknown> } }).response
    const status = response?.status

    // An unknown code is a bad code, never a server outage.
    if (status === 404) return { ok: false, message: INVALID_COUPON_MESSAGE }

    // Business rejections (not applicable, expired, limit reached…) carry a meaningful
    // backend message — surface it rather than a generic failure.
    if (status === 400 || status === 409 || status === 422) {
      const backendMessage = readCouponApiMessage(response?.data?.message, '')
      return { ok: false, message: backendMessage || INVALID_COUPON_MESSAGE }
    }

    // Only genuine server/network failures fall through to the generic message.
    return { ok: false, message: readCouponApiError(error, INVALID_COUPON_MESSAGE) }
  }
}
