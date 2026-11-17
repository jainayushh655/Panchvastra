import api from './axios'
import { adminAuthConfig, MissingAdminSessionError } from './adminRequest'
import type {
  CreateCustomRequestPayload,
  CustomRequestDto,
  CustomRequestHistoryDto,
  CustomRequestPaginationDto,
  CustomRequestQuery,
  UpdateCustomRequestPayload,
} from '@/types/api/CustomPieceDto'

/**
 * Custom Piece requests — `/v1/custom_requests/`.
 *
 * POST requires a login. The shared client attaches the shopper's bearer token, so there is
 * no second auth path here; a logged-out caller gets the 401 the endpoint documents, which
 * the page turns into its existing login redirect rather than a raw error.
 *
 * VERIFIED LIVE: GET without a token returns 401
 *   {"success": false, "message": "Authorization token missing.", "data": {}}
 *
 * The published schema documents the request body exactly but declares NO response schema
 * for any verb on this path, so this module reads only the envelope fields that every
 * Panchvastra endpoint is known to return (`success`, `message`, `data`). The confirmation
 * shown to the customer is the API's own `message`; no request-number or detail-link field
 * is read, because none has been verified and inventing one would silently render blank.
 */

const PATH = '/v1/custom_requests/'

type Envelope = { success?: boolean; message?: unknown; data?: unknown }

const GENERIC_FAILURE = 'Something went wrong. Please try again.'
const OFFLINE = 'Unable to connect to the server. Check your connection and try again.'
const RATE_LIMITED = "You're sending requests too quickly. Please wait a minute and try again."

function responseOf(error: unknown) {
  return (error as { response?: { status?: number; data?: Envelope } }).response
}

/** True when the failure is "you are not signed in", which the page answers with a redirect. */
export function isUnauthenticated(error: unknown): boolean {
  return responseOf(error)?.status === 401
}

/**
 * Per-field errors from a 400. The backend sends `message` as EITHER a plain string or an
 * object of field -> messages; only the object form yields field errors, and a string 400
 * falls through to `readCustomRequestApiError` as a single banner.
 */
export function readCustomRequestFieldErrors(error: unknown): Record<string, string> {
  const response = responseOf(error)
  if (response?.status !== 400) return {}

  const message = response.data?.message
  if (!message || typeof message !== 'object' || Array.isArray(message)) return {}

  const out: Record<string, string> = {}
  for (const [field, value] of Object.entries(message as Record<string, unknown>)) {
    const first = Array.isArray(value)
      ? value.find((v): v is string => typeof v === 'string' && v.trim().length > 0)
      : typeof value === 'string' && value.trim()
        ? value
        : undefined
    if (first) out[field] = first
  }
  return out
}

/** Any failure as one safe line — never a stack, SQL or exception text. */
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
 * `Content-Type` is explicitly unset so the browser generates the multipart boundary; the
 * shared client's JSON default would otherwise make the body unparseable. Optional fields
 * are omitted entirely when empty rather than sent blank, so "no description" and "no file"
 * reach the backend as absent, which is what the contract's nullable fields describe.
 *
 * Returns the API's own confirmation text. The created request's number and detail link are
 * NOT read: the published schema declares no response body for this endpoint, so there is no
 * verified field name to read them from.
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

  const response = await api.post<Envelope>(PATH, form, {
    headers: { 'Content-Type': undefined },
  })

  const message = response.data?.message
  return typeof message === 'string' && message.trim()
    ? message
    : 'Thanks — your custom request has been received.'
}

/* ------------------------------------------------------------------ admin reads/writes */

export { MissingAdminSessionError }

export type CustomRequestListResult = {
  rows: CustomRequestDto[]
  /** null when the response carried no pagination block — never fabricated. */
  pagination: CustomRequestPaginationDto | null
}

function toParams(query: CustomRequestQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {}
  if (query.id !== undefined) params.id = query.id
  if (query.page !== undefined) params.page = query.page
  if (query.page_size !== undefined) params.page_size = query.page_size
  if (query.search_parameter?.trim()) params.search_parameter = query.search_parameter.trim()
  if (query.status?.trim()) params.status = query.status.trim()
  return params
}

/**
 * GET /v1/custom_requests/ with the admin token — an admin token returns every customer's
 * requests, per the endpoint's own description.
 *
 * An empty `data` array is a normal empty state, not a failure. `data` is accepted as
 * either a bare array or an object wrapping one, because the response is undocumented and
 * both are common on this backend; anything else degrades to an empty list rather than
 * throwing.
 */
export async function getAdminCustomRequests(query: CustomRequestQuery = {}): Promise<CustomRequestListResult> {
  const response = await api.get<{ data?: unknown; pagination?: CustomRequestPaginationDto | null }>(PATH, {
    ...adminAuthConfig(),
    params: toParams(query),
  })

  return {
    rows: toRows(response.data?.data),
    pagination: response.data?.pagination ?? null,
  }
}

/** GET /v1/custom_requests/?id=<id> — one request plus its history. */
export async function getAdminCustomRequest(id: number): Promise<CustomRequestDto | null> {
  const response = await api.get<{ data?: unknown }>(PATH, {
    ...adminAuthConfig(),
    params: { id },
  })
  const data = response.data?.data
  if (Array.isArray(data)) return (data[0] as CustomRequestDto) ?? null
  if (data && typeof data === 'object') return data as CustomRequestDto
  return null
}

/**
 * PUT /v1/custom_requests/ — status, note, or both. Returns the full request as the API
 * now holds it, so the caller replaces its row with the response rather than assuming the
 * update landed the way it was sent.
 */
export async function updateCustomRequest(payload: UpdateCustomRequestPayload): Promise<CustomRequestDto | null> {
  const body: Record<string, unknown> = { id: payload.id }
  if (payload.status) body.status = payload.status
  if (payload.note?.trim()) body.note = payload.note.trim()

  const response = await api.put<{ data?: unknown }>(PATH, body, adminAuthConfig())
  const data = response.data?.data
  if (Array.isArray(data)) return (data[0] as CustomRequestDto) ?? null
  if (data && typeof data === 'object' && Object.keys(data).length > 0) return data as CustomRequestDto
  return null
}

/** True when the request is gone — the row is dropped rather than left stale. */
export function isCustomRequestMissing(error: unknown): boolean {
  return responseOf(error)?.status === 404
}

function toRows(data: unknown): CustomRequestDto[] {
  if (Array.isArray(data)) return data.filter((r): r is CustomRequestDto => !!r && typeof r === 'object')
  if (data && typeof data === 'object') {
    for (const value of Object.values(data as Record<string, unknown>)) {
      if (Array.isArray(value)) return value.filter((r): r is CustomRequestDto => !!r && typeof r === 'object')
    }
  }
  return []
}

/* ------------------------------------------------------- undocumented-field accessors */

/**
 * The response shape is not published (see `CustomRequestDto`), so every display value is
 * read through one of these. Each tries a short list of candidate keys and returns null
 * when none is present, which renders as a dash.
 *
 * This is the ONLY place a field name is assumed. If a column comes up empty against the
 * real API, the fix is to add the actual key to the list below — one line, one file.
 */
function pick(row: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  if (!row) return null
  for (const key of keys) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return null
}

export const customRequestFields = {
  /** Human-facing reference. Falls back to the id so a row is never unidentifiable. */
  reference: (r: CustomRequestDto) =>
    pick(r, ['request_number', 'request_no', 'reference_number', 'reference', 'number']) ?? `#${r.id}`,
  garment: (r: CustomRequestDto) => pick(r, ['garment_name', 'garment']),
  colour: (r: CustomRequestDto) => pick(r, ['colour_name', 'color_name', 'colour', 'color']),
  size: (r: CustomRequestDto) => pick(r, ['size_name', 'size']),
  printType: (r: CustomRequestDto) => pick(r, ['print_type_name', 'print_type']),
  statusValue: (r: CustomRequestDto) => pick(r, ['status']),
  statusLabel: (r: CustomRequestDto) => pick(r, ['status_label', 'status']),
  customerName: (r: CustomRequestDto) => pick(r, ['full_name', 'customer_name', 'user_name', 'name']),
  email: (r: CustomRequestDto) => pick(r, ['email', 'user_email', 'customer_email']),
  phone: (r: CustomRequestDto) => pick(r, ['phone_number', 'phone', 'mobile']),
  countryCode: (r: CustomRequestDto) => pick(r, ['phone_country_code', 'country_code']),
  description: (r: CustomRequestDto) => pick(r, ['design_description', 'description']),
  designUrl: (r: CustomRequestDto) =>
    pick(r, ['design_file_url', 'design_file', 'design_url', 'file_url', 'design']),
  createdAt: (r: CustomRequestDto) => pick(r, ['created_at', 'created', 'created_on', 'date_created']),
  updatedAt: (r: CustomRequestDto) => pick(r, ['updated_at', 'modified_at', 'updated']),
  history: (r: CustomRequestDto): CustomRequestHistoryDto[] => {
    for (const key of ['history', 'status_history', 'logs', 'timeline', 'events']) {
      const value = r[key]
      if (Array.isArray(value)) return value.filter((e): e is CustomRequestHistoryDto => !!e && typeof e === 'object')
    }
    return []
  },
  historyNote: (e: CustomRequestHistoryDto) => pick(e, ['note', 'comment', 'message']),
  historyStatus: (e: CustomRequestHistoryDto) => pick(e, ['status_label', 'status', 'to_status', 'new_status']),
  historyActor: (e: CustomRequestHistoryDto) => pick(e, ['changed_by_name', 'changed_by', 'actor', 'admin_name', 'user']),
  historyAt: (e: CustomRequestHistoryDto) => pick(e, ['created_at', 'created', 'timestamp', 'changed_at']),
}
