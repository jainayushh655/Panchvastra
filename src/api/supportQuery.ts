import api from './axios'
import { adminAuthConfig, MissingAdminSessionError } from './adminRequest'
import { SUPPORT_FIELDS } from '@/types/api/SupportQueryDto'
import type {
  CreateSupportQueryDto,
  SupportFieldErrors,
  SupportQueryDto,
  SupportQueryPaginationDto,
  SupportQueryParams,
  UpdateSupportQueryDto,
} from '@/types/api/SupportQueryDto'

export { MissingAdminSessionError }

/**
 * Help Desk API.
 *
 * Two surfaces, two credentials, and they never mix:
 *   - `POST /v1/support_query/` is PUBLIC. It goes through the shared `api` client, which
 *     attaches the shopper's bearer token when there is a session and simply omits it when
 *     there is not — so the form works logged out without a second auth path.
 *   - `GET`/`PUT /v1/support_queries/` are ADMIN. They pass `adminAuthConfig()` explicitly,
 *     which throws before the request when there is no admin session, so these can never be
 *     reached with a shopper's token.
 *
 * Base URL, interceptors and headers all come from the existing client — no new HTTP layer.
 */

type SupportEnvelope<T> = {
  success?: boolean
  message?: unknown
  data?: T
  pagination?: SupportQueryPaginationDto | null
}

/** The exact strings the Help Desk form is specified to show. */
const RATE_LIMITED = "You're sending messages too quickly. Please wait a minute and try again."
const GENERIC_FAILURE = 'Something went wrong. Please try again.'

function responseOf(error: unknown) {
  return (error as { response?: { status?: number; data?: SupportEnvelope<unknown> } }).response
}

/**
 * Per-field validation messages from a 400.
 *
 * The backend answers a rejected submission with `message` as an object keyed by field
 * name, each holding an array of strings. Only the four fields the form actually posts are
 * read, so an unexpected key cannot attach an error to an input that does not exist; the
 * first message per field is used, since that is the one the input has room to show.
 *
 * Returns an empty object for anything that is not a field-shaped 400 — callers then fall
 * back to `readSupportApiError` for a single banner line.
 */
export function readSupportFieldErrors(error: unknown): SupportFieldErrors {
  const response = responseOf(error)
  if (response?.status !== 400) return {}

  const message = response.data?.message
  if (!message || typeof message !== 'object' || Array.isArray(message)) return {}

  const source = message as Record<string, unknown>
  const errors: SupportFieldErrors = {}

  for (const field of SUPPORT_FIELDS) {
    const value = source[field]
    const text = Array.isArray(value)
      ? value.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
      : typeof value === 'string' && value.trim()
        ? value
        : undefined
    if (text) errors[field] = text.trim()
  }

  return errors
}

/**
 * A single user-safe line for a failed submission.
 *
 * 429 and 5xx/network use the exact wording the Help Desk specifies. A 5xx body is never
 * surfaced — those can carry a Django debug page or raw SQL. A 400 that carried field
 * errors is handled by `readSupportFieldErrors` instead; this only covers a 400 whose
 * `message` is a plain string.
 */
export function readSupportApiError(error: unknown, fallback = GENERIC_FAILURE): string {
  if (error instanceof MissingAdminSessionError) return error.message

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

/* ------------------------------------------------------------------ customer */

/**
 * `POST /v1/support_query/` — submits the Help Desk form.
 *
 * Sends exactly the four documented fields and nothing else. Resolves with the API's own
 * success `message`, which the page shows verbatim rather than substituting its own wording
 * (the backend decides what it did; the UI never claims an email was sent).
 */
export async function createSupportQuery(payload: CreateSupportQueryDto): Promise<string> {
  const response = await api.post<SupportEnvelope<unknown>>('/v1/support_query/', {
    name: payload.name,
    email: payload.email,
    category: payload.category,
    message: payload.message,
  })

  const message = response.data?.message
  return typeof message === 'string' && message.trim() ? message.trim() : 'Thanks — your message has been received.'
}

/* ------------------------------------------------------------------ admin */

/** Drops empty values so only parameters the caller actually set reach the wire. */
function toParams(query: SupportQueryParams): Record<string, string | number> {
  const params: Record<string, string | number> = {}
  if (query.id !== undefined && query.id !== '') params.id = query.id
  if (query.page !== undefined) params.page = query.page
  if (query.page_size !== undefined) params.page_size = query.page_size
  if (query.category) params.category = query.category
  if (query.status) params.status = query.status
  if (query.search_parameter?.trim()) params.search_parameter = query.search_parameter.trim()
  return params
}

export interface SupportQueryListResult {
  queries: SupportQueryDto[]
  /** null when the response carried no pagination block — never fabricated. */
  pagination: SupportQueryPaginationDto | null
  /** The envelope's own `message`, shown as-is on an empty list ("Data not found."). */
  message: string
}

/**
 * `GET /v1/support_queries/` — the admin inbox.
 *
 * Rows are returned in the order the backend sent them. It already orders unresolved
 * queries first and then by newest, so nothing is re-sorted here — doing so would fight
 * that ordering and would only ever reorder the page already loaded.
 *
 * An empty `data` array is a normal empty state, not a failure, and the pagination block is
 * allowed to be absent or empty for it.
 */
export async function getAdminSupportQueries(query: SupportQueryParams = {}): Promise<SupportQueryListResult> {
  const response = await api.get<SupportEnvelope<SupportQueryDto[]>>('/v1/support_queries/', {
    ...adminAuthConfig(),
    params: toParams(query),
  })

  const data = response.data?.data
  const message = response.data?.message
  return {
    queries: Array.isArray(data) ? data : [],
    pagination: response.data?.pagination ?? null,
    message: typeof message === 'string' ? message : '',
  }
}

/**
 * `PUT /v1/support_queries/` — changes a query's status (admin).
 *
 * Sends only `id` and `status`, the two fields the contract defines. The response carries
 * the complete updated query, which the caller swaps into the row it already has — no
 * refetch of the list, and nothing is shown as changed before the server confirms it.
 */
export async function updateSupportQueryStatus(payload: UpdateSupportQueryDto): Promise<SupportQueryDto | null> {
  const response = await api.put<SupportEnvelope<SupportQueryDto>>(
    '/v1/support_queries/',
    { id: payload.id, status: payload.status },
    adminAuthConfig(),
  )

  const data = response.data?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return data
}

/** True when a thrown error is the backend saying the query is gone. */
export function isSupportQueryMissing(error: unknown): boolean {
  return responseOf(error)?.status === 404
}
