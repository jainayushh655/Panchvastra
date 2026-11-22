import api from '@/services/http/client'
import { ENDPOINTS } from '@/services/endpoints'
import { readApiMessage } from '@/services/http/apiMessage'
import type { NotifyMeCreateDto } from '@/types/api/NotifyMeDto'

/**
 * Restock notifications — POST /v1/notify_me/.
 *
 * Ported from the Vite `src/api/notifyMe.ts`, customer half only; the admin waitlist
 * functions move with the admin panel in Phase 5.
 *
 * VERIFIED LIVE by the Vite app, and the reason the error handling below is shaped the
 * way it is — unlike most of this backend, these routes are NOT authentication-gated:
 *
 *   POST with no body     -> 400 { message: { variant_size_id: [...], email: [...] } }
 *   POST bad email        -> 400 { message: { email: ["Enter a valid email address."] } }
 *   POST unknown size id  -> 404 { message: "Product size not found." }
 *   POST in-stock size id -> 400 { message: "This size is already in stock." }
 *
 * So the request contract is confirmed exactly (`variant_size_id` + `email`), and the
 * BACKEND enforces that a size must genuinely be out of stock. No 2xx payload could be
 * observed, so nothing is read from the success body — the call resolves or it throws.
 */

/** One subscription: exactly one size per submission, never a list. */
export async function createNotifySubscription(variantSizeId: number, email: string): Promise<void> {
  const payload: NotifyMeCreateDto = { variant_size_id: variantSizeId, email: email.trim() }
  await api.post(ENDPOINTS.notifyMe, payload)
}

/**
 * Turns a thrown request error into a message safe to show a shopper.
 *
 * The backend's own 400/404 wording IS the useful part here ("This size is already in
 * stock.", "Enter a valid email address."), so it is surfaced verbatim for those. 5xx
 * bodies on this backend can carry raw exception text and are never shown.
 */
export function readNotifyApiError(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: { message?: unknown } } }).response
  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  if (response.status && response.status >= 500) {
    return 'The server is temporarily unavailable. Please try again shortly.'
  }

  return readApiMessage(response.data?.message, fallback)
}
