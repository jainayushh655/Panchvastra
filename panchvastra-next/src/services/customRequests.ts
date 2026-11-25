import api, { publicApi } from '@/services/http/client'
import { ENDPOINTS } from '@/services/endpoints'
import { customerMultipartConfig } from '@/services/http/multipart'
import { readApiFieldErrors, responseOf } from '@/services/http/apiMessage'
import { toCustomOptions } from '@/lib/customOptions'
import type { ApiEnvelope } from '@/services/http/apiMessage'
import type { CreateCustomRequestPayload, CustomOptionsDto } from '@/types/api/CustomPieceDto'

/**
 * Custom Piece — the CUSTOMER half of the Vite `src/api/customRequests.ts`, plus the
 * public options read from `src/api/customOptions.ts`.
 *
 * `POST /v1/custom_requests/` REQUIRES A SESSION. The shared client attaches the shopper's
 * bearer token, so there is no second auth path here and no second HTTP client; a
 * signed-out caller gets the 401 the endpoint documents, which the builder turns into its
 * existing login redirect rather than a raw error.
 *
 * VERIFIED LIVE by the Vite app against the production API:
 *   GET /v1/custom_options/  (no token) -> 200, the four option lists
 *   GET /v1/custom_requests/ (no token) -> 401
 *     {"success": false, "message": "Authorization token missing.", "data": {}}
 *
 * The published schema documents the request body for every verb on `/v1/custom_requests/`
 * but declares NO response schema for any of them, so this module reads only the envelope
 * fields every Panchvastra endpoint is known to return (`success`, `message`, `data`). The
 * confirmation shown to the customer is the API's own `message`; no request-number or
 * detail-link field is read, because none has been verified and inventing one would
 * silently render blank. See `types/api/CustomPieceDto.ts` for the full record of what is
 * documented and what is not.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT IS DELIBERATELY NOT HERE
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite modules also hold `getAdminCustomRequests`, `getAdminCustomRequest`,
 * `updateCustomRequest`, `isCustomRequestMissing`, `customRequestFields` and the whole
 * admin options CRUD, all of which pass an ADMIN token. Those belong to the admin panel
 * and move with it in Phase 5. Leaving them out keeps the shopper's bundle free of admin
 * paths and the undocumented-field accessors in one place when they arrive.
 *
 * The session-expiry interceptor in `http/client.ts` is NOT bypassed or weakened, and
 * `customRequests` is deliberately NOT added to `CALLER_HANDLED_401`: a 401 here means the
 * stored token really is no longer accepted, and the shared signal clearing that session is
 * the correct outcome. The builder ALSO redirects to sign-in with the draft parked, which
 * is what the Vite page does, so the two are consistent rather than competing.
 */

/** The exact strings the Vite page shows. Kept verbatim — they are user-visible copy. */
const GENERIC_FAILURE = 'Something went wrong. Please try again.'
const OFFLINE = 'Unable to connect to the server. Check your connection and try again.'
const RATE_LIMITED = "You're sending requests too quickly. Please wait a minute and try again."

/**
 * True when the failure is "you are not signed in", which the builder answers with a
 * redirect to the login screen.
 *
 * 401 ONLY. The shared `isUnauthenticated` in `http/apiMessage.ts` treats 403 as
 * unauthenticated too, and reusing it here would be wrong in a user-visible way: a 403
 * means the account exists and is refused, so signing in again cannot help. The Vite
 * module draws the same line, and `readCustomRequestApiError` below gives 403 its own
 * sentence instead of bouncing anyone to a login form.
 */
export function isUnauthenticated(error: unknown): boolean {
  return responseOf(error)?.status === 401
}

/**
 * Per-field errors from a 400, keyed by the API's own field names (`garment_id`,
 * `full_name`, `phone_number`, …) so the builder can show each one against the input that
 * caused it.
 *
 * Built on the shared `readApiFieldErrors`. The backend sends `message` as EITHER a plain
 * string or an object of `field -> messages`; only the object form yields field errors, and
 * a string 400 falls through to `readCustomRequestApiError` as a single banner.
 *
 * Unlike the Help Desk service this does NOT narrow to a fixed field list. It does not need
 * to: the builder renders a banner for any key it has no input for (see
 * `unplacedFieldError` in the island), so an unexpected key is surfaced rather than
 * stranding the form, and `design_file` legitimately arrives for a control whose error
 * slot is shared with the client-side file check.
 */
export function readCustomRequestFieldErrors(error: unknown): Record<string, string> {
  const response = responseOf(error)
  if (response?.status !== 400) return {}

  const message = response.data?.message
  // A string `message` is a banner, not field errors; an array is neither.
  if (!message || typeof message !== 'object' || Array.isArray(message)) return {}

  return readApiFieldErrors(message)
}

/**
 * Any failure as one safe line — never a stack, SQL or exception text.
 *
 * The status rules are the Vite module's, unchanged, and each one matters:
 *   - no `response` at all is a network failure, a timeout or an abort, and must not read
 *     as an account problem;
 *   - a 5xx body on this backend can carry a Django debug page or raw SQL, so it is never
 *     surfaced;
 *   - 401/403/429 get their own sentences, because the generic line would leave the
 *     shopper with nothing to do about it;
 *   - a 4xx `message` IS surfaced, because the contract states it is written for end users.
 *
 * The field-keyed form is flattened WITH its field names (`full_name: This field is
 * required.`), which is what the Vite module does, so a validation error for a field the
 * builder has no input for still says what is wrong.
 */
export function readCustomRequestApiError(error: unknown, fallback = GENERIC_FAILURE): string {
  const response = responseOf(error)
  if (!response) return OFFLINE

  const status = response.status
  if (status === 429) return RATE_LIMITED
  if (status === 401) return 'Please sign in to send your request.'
  if (status === 403) return 'You do not have permission to send this request.'
  if (status && status >= 500) return GENERIC_FAILURE

  const message = response.data?.message
  if (typeof message === 'string' && message.trim()) return message

  if (message && typeof message === 'object' && !Array.isArray(message)) {
    const parts: string[] = []
    for (const [field, value] of Object.entries(message as Record<string, unknown>)) {
      const texts = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string')
        : typeof value === 'string'
          ? [value]
          : []
      for (const text of texts) {
        parts.push(field === 'detail' || field === 'non_field_errors' ? text : `${field}: ${text}`)
      }
    }
    if (parts.length) return parts.join(' ')
  }

  return fallback
}

/**
 * POST /v1/custom_requests/ — multipart/form-data.
 *
 * Three things here are load-bearing and must not change:
 *
 *  1. `Content-Type` is explicitly UNSET, through the shared `customerMultipartConfig()`,
 *     so the browser generates the multipart boundary. The shared client's
 *     `application/json` default would otherwise make the body unparseable server-side,
 *     and setting `"multipart/form-data"` by hand omits the `boundary=` parameter, which
 *     fails the same way.
 *
 *  2. The Authorization header is NOT set here. The shared client's request interceptor
 *     attaches the customer token, which is the only credential this endpoint accepts.
 *
 *  3. Optional fields are OMITTED ENTIRELY when empty rather than sent blank, so "no
 *     description" and "no file" reach the backend as absent — which is what the
 *     contract's nullable fields describe. The endpoint requires at least one of the two;
 *     the builder enforces that before calling.
 *
 * Returns the API's own confirmation text, shown to the customer verbatim.
 */
export async function createCustomRequest(payload: CreateCustomRequestPayload): Promise<string> {
  const form = new FormData()

  form.append('garment_id', String(payload.garment_id))
  form.append('colour_id', String(payload.colour_id))
  form.append('size_id', String(payload.size_id))
  form.append('print_type_id', String(payload.print_type_id))
  form.append('full_name', payload.full_name)
  form.append('phone_country_code', payload.phone_country_code)
  form.append('phone_number', payload.phone_number)

  if (payload.design_file) form.append('design_file', payload.design_file)
  if (payload.design_description?.trim()) form.append('design_description', payload.design_description.trim())

  const response = await api.post<ApiEnvelope>(ENDPOINTS.customRequests, form, customerMultipartConfig())

  const message = response.data?.message
  return typeof message === 'string' && message.trim()
    ? message
    : 'Thanks — your custom request has been received.'
}

/**
 * GET /v1/custom_options/ from the BROWSER, with no Authorization header.
 *
 * The page reads these on the server (`services/server/catalog.ts` →
 * `getCustomPieceOptions`), which is anonymous by construction and puts the real choices in
 * the HTML. This is the fallback for the one case that read cannot cover: a page prerendered
 * before the API was reachable — notably `next build` in an environment with no API origin
 * configured, which is how this migration is built locally and in CI.
 *
 * It goes through `publicApi`, the bare client the Phase 2 foundation added for exactly this
 * endpoint. That is not a second HTTP client in the sense that matters — same base URL, same
 * timeout, one axios configuration — it simply has no auth interceptor, because this endpoint
 * changes its response for a privileged token and a signed-in shopper must not be shown a
 * different set of options from a signed-out one. Deleting the header per-request on the
 * shared client is NOT equivalent: the interceptor would still have run.
 */
export async function fetchCustomOptions(): Promise<CustomOptionsDto> {
  const response = await publicApi.get<ApiEnvelope<CustomOptionsDto>>(ENDPOINTS.customOptions)
  return toCustomOptions(response.data?.data)
}
