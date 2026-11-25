import api from '@/services/http/client'
import { ENDPOINTS } from '@/services/endpoints'
import { readApiFieldErrors, responseOf } from '@/services/http/apiMessage'
import { SUPPORT_FIELDS } from '@/types/api/SupportQueryDto'
import type { ApiEnvelope } from '@/services/http/apiMessage'
import type { CreateSupportQueryDto, SupportFieldErrors } from '@/types/api/SupportQueryDto'

/**
 * Help Desk API — the CUSTOMER half of the Vite `src/api/supportQuery.ts`.
 *
 * `POST /v1/support_query/` is PUBLIC. It goes through the shared client, which attaches
 * the shopper's bearer token when there is a session and simply omits it when there is
 * not — so the form works signed out with no second auth path and no second HTTP client.
 *
 * VERIFIED LIVE by the Vite app against the production API (2026-10-07), which is why the
 * handling below is shaped the way it is:
 *
 *   POST with no body / bad values -> 400, and `message` is an OBJECT keyed by field:
 *     {"success":false,"message":{"email":["Enter a valid email address."],
 *       "category":["\"BOGUS\" is not a valid choice."]},"data":{}}
 *   GET on the same path          -> 405 (write-only)
 *   Unauthenticated POST          -> 400 validation, NOT 401 (so it really is public)
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT IS DELIBERATELY NOT HERE
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite module also holds `getAdminSupportQueries`, `updateSupportQueryStatus` and
 * `isSupportQueryMissing`, which read and write the PLURAL `/v1/support_queries/` with an
 * admin token. Those belong to the admin panel and move with it in Phase 5. Leaving them
 * out keeps the shopper's bundle free of admin paths and keeps this file single-owner.
 *
 * The session-expiry interceptor in `http/client.ts` is NOT bypassed or weakened: it
 * already fires only for a 401 when a token is actually stored, so an anonymous visitor
 * posting this form can never be "signed out" by it.
 */

/** The exact strings the Help Desk is specified to show. Kept verbatim from the Vite app. */
const RATE_LIMITED = "You're sending messages too quickly. Please wait a minute and try again."
const GENERIC_FAILURE = 'Something went wrong. Please try again.'

/**
 * Per-field validation messages from a 400.
 *
 * Built on the shared `readApiFieldErrors`, then NARROWED to the four fields this form
 * actually posts. That narrowing is the point, and it is not tidiness: without it an
 * unexpected key in the response would carry an error for an input that does not exist on
 * screen, which the user could neither see nor clear — leaving the form permanently
 * unsubmittable with no visible reason.
 *
 * Returns an empty object for anything that is not a field-shaped 400. Callers then fall
 * back to `readSupportApiError` for a single banner line.
 */
export function readSupportFieldErrors(error: unknown): SupportFieldErrors {
  const response = responseOf(error)
  if (response?.status !== 400) return {}

  const message = response.data?.message
  // A string `message` is a banner, not field errors; an array is neither.
  if (!message || typeof message !== 'object' || Array.isArray(message)) return {}

  const all = readApiFieldErrors(message)
  const errors: SupportFieldErrors = {}

  for (const field of SUPPORT_FIELDS) {
    const text = all[field]?.trim()
    if (text) errors[field] = text
  }

  return errors
}

/**
 * A single user-safe line for a failed submission.
 *
 * 429 and 5xx/network use the exact wording the Help Desk specifies. A 5xx body is NEVER
 * surfaced — this backend can answer a 500 with a Django debug page or raw SQL. A 400 that
 * carried field errors is handled by `readSupportFieldErrors` instead; this covers only a
 * 400 whose `message` is a plain string.
 *
 * This keeps the Vite module's own wording rather than delegating to the shared
 * `readApiError`, which differs on several branches ("Too many requests. Please try again
 * in a moment." for 429, and a different offline line). That wording is what the live form
 * shows today, and a migration is not the place to change what a user reads.
 */
export function readSupportApiError(error: unknown, fallback = GENERIC_FAILURE): string {
  const response = responseOf(error)
  // No response at all — the request never completed.
  if (!response) return GENERIC_FAILURE

  const status = response.status
  if (status === 429) return RATE_LIMITED
  if (status && status >= 500) return GENERIC_FAILURE

  const message = response.data?.message
  if (typeof message === 'string' && message.trim()) return message.trim()

  if (status === 401 || status === 403) return 'Your session has expired. Please sign in again.'
  if (status === 404) return 'That query could not be found.'

  return fallback
}

/**
 * `POST /v1/support_query/` — submits the Help Desk form.
 *
 * Sends exactly the four documented fields and nothing else; the `category` VALUE is sent,
 * never its display label. Resolves with the API's own success `message`, which the page
 * shows verbatim rather than substituting its own wording — the backend decides what it
 * did, and the UI never claims an email was sent.
 */
export async function createSupportQuery(payload: CreateSupportQueryDto): Promise<string> {
  const response = await api.post<ApiEnvelope>(ENDPOINTS.supportQuery, {
    name: payload.name,
    email: payload.email,
    category: payload.category,
    message: payload.message,
  })

  const message = response.data?.message
  return typeof message === 'string' && message.trim()
    ? message.trim()
    : 'Thanks — your message has been received.'
}
