import api from './axios'
import { adminAuthConfig, MissingAdminSessionError } from './adminRequest'

export { MissingAdminSessionError }

/**
 * Quantity discount tiers — `/v1/quantity_discount_tiers/`.
 *
 * These drive the "More you shop, more you save" offer. The important thing to hold on to
 * when reading any UI built on them: a tier applies to the TOTAL number of items in the
 * cart, across different products — not per product and not per line. The product page
 * advertises them; the cart summary and the checkout response are where the real figures
 * come from, and the frontend never recomputes either.
 *
 * Admin-only. The storefront reads tiers off the product detail response instead.
 */

const PATH = '/v1/quantity_discount_tiers/'

/** Backend bounds, mirrored so the form can reject before the request. */
export const MIN_TIER_QUANTITY = 2
export const MIN_TIER_PERCENTAGE = 0.01
export const MAX_TIER_PERCENTAGE = 90

export interface QuantityTierDto {
  id: number
  /** Cart item count at which this tier starts. Always ≥ 2. */
  min_quantity: number
  /** Percent off, e.g. `15.0`. */
  discount_percentage: number
  is_active: boolean
}

export interface QuantityTierWritePayload {
  min_quantity: number
  discount_percentage: number
  is_active?: boolean
}

type Envelope<T> = { success?: boolean; message?: unknown; data?: T }

/** Flattens the two `message` shapes this backend uses into one displayable line. */
export function readQuantityTierApiMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim()) return message.trim()

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

/** Turns a thrown request error into a message that is safe to show an admin. */
export function readQuantityTierApiError(error: unknown, fallback: string): string {
  if (error instanceof MissingAdminSessionError) return error.message

  const response = (error as { response?: { status?: number; data?: Envelope<unknown> } }).response
  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const status = response.status
  if (status && status >= 500) return 'The server is temporarily unavailable. Please try again shortly.'

  const message = readQuantityTierApiMessage(response.data?.message, '')
  if (message) return message

  if (status === 401) return 'Your admin session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to manage quantity offers.'
  if (status === 404) return 'That offer could not be found.'
  if (status === 409) return 'There is already an offer for that quantity. Edit the existing one instead.'

  return fallback
}

/** Validates a tier against the documented bounds. Returns an error, or null when valid. */
export function validateQuantityTier(minQuantity: number, discountPercentage: number): string | null {
  if (!Number.isInteger(minQuantity) || minQuantity < MIN_TIER_QUANTITY) {
    return `Minimum quantity must be a whole number of ${MIN_TIER_QUANTITY} or more.`
  }
  if (!Number.isFinite(discountPercentage) || discountPercentage < MIN_TIER_PERCENTAGE || discountPercentage > MAX_TIER_PERCENTAGE) {
    return `Discount must be between ${MIN_TIER_PERCENTAGE} and ${MAX_TIER_PERCENTAGE} percent.`
  }
  return null
}

/** `GET /v1/quantity_discount_tiers/?include_inactive=true` — the admin list. */
export async function getQuantityTiers(includeInactive = true): Promise<QuantityTierDto[]> {
  const response = await api.get<Envelope<QuantityTierDto[]>>(PATH, {
    ...adminAuthConfig(),
    params: includeInactive ? { include_inactive: true } : undefined,
  })
  const data = Array.isArray(response.data?.data) ? response.data.data : []
  // Ascending by threshold, so the ladder reads the way a shopper experiences it.
  return [...data].sort((a, b) => a.min_quantity - b.min_quantity)
}

/** `POST` — 409 when a tier already exists for that quantity. */
export async function createQuantityTier(payload: QuantityTierWritePayload): Promise<void> {
  await api.post<Envelope<QuantityTierDto>>(PATH, payload, adminAuthConfig())
}

/** `PUT` — `id` plus only the fields that changed. */
export async function updateQuantityTier(payload: Partial<QuantityTierWritePayload> & { id: number }): Promise<void> {
  await api.put<Envelope<QuantityTierDto>>(PATH, payload, adminAuthConfig())
}

/** `DELETE ?id=…`. */
export async function deleteQuantityTier(id: number): Promise<void> {
  await api.delete<Envelope<unknown>>(PATH, { ...adminAuthConfig(), params: { id } })
}
