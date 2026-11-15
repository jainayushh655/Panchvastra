/**
 * The backend's two `message` shapes, read safely — the one convention every service
 * in the Vite application implements independently.
 *
 * THE CONTRACT. Every endpoint on this backend answers with the same envelope:
 *
 *     { success?: boolean, message?: string | Record<string, string[]>, data?: unknown,
 *       pagination?: {...} }
 *
 * `message` is a plain string for auth and business failures, and an object of
 * `field -> string[]` for validation failures. Both arrive from the same endpoint. The
 * Vite app verified this live against `/v1/login_admin/` (401 → string, 400 → object) and
 * handles both everywhere.
 *
 * WHY THIS MODULE EXISTS. The Vite app has eight near-identical copies of this flattener
 * (`readProductApiMessage`, `readOrderApiMessage`, `readCategoryApiMessage`, …) because it
 * grew one service at a time. They differ only in their fallback string and, in the
 * product service, in prefixing the field name. New code in this application uses the
 * functions here instead of adding a ninth copy.
 *
 * WHAT THIS MODULE DOES NOT DO. It does not replace those eight functions. Each service
 * is ported verbatim in a later phase, keeping its own wording and its own fallback,
 * because that wording is what the screens display today and changing it is a visible
 * behaviour change. This is the shared foundation, not a rewrite of them.
 */

/** The shared response envelope. `T` is whatever the endpoint puts in `data`. */
export type ApiEnvelope<T = unknown> = {
  success?: boolean
  message?: unknown
  data?: T
  pagination?: unknown
}

/**
 * Flattens `message` into one displayable line.
 *
 * A string is returned trimmed. An object is flattened by concatenating every string in
 * every value, in key order, so React is never handed an object to render. Anything else
 * yields `fallback`.
 */
export function readApiMessage(message: unknown, fallback = ''): string {
  if (typeof message === 'string' && message.trim()) return message.trim()

  if (message && typeof message === 'object') {
    const parts: string[] = []
    for (const value of Object.values(message as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        parts.push(...value.filter((entry): entry is string => typeof entry === 'string'))
      } else if (typeof value === 'string') {
        parts.push(value)
      }
    }
    if (parts.length) return parts.join(' ')
  }

  return fallback
}

/**
 * Flattens `message` while keeping the FIELD NAME against each error.
 *
 * The product service does this so "name: This field is required." tells the admin which
 * input to fix. `detail` is the backend's own non-field key and is emitted bare.
 */
export function readApiMessageWithFields(message: unknown, fallback = ''): string {
  if (typeof message === 'string' && message.trim()) return message.trim()

  if (message && typeof message === 'object') {
    const parts: string[] = []
    for (const [field, value] of Object.entries(message as Record<string, unknown>)) {
      const texts = Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === 'string')
        : typeof value === 'string'
          ? [value]
          : []
      for (const text of texts) parts.push(field === 'detail' ? text : `${field}: ${text}`)
    }
    if (parts.length) return parts.join(' ')
  }

  return fallback
}

/**
 * `message` split per field, for attaching errors to the inputs that caused them.
 *
 * Used by the forms that do inline validation (Help Desk, Custom Piece). Only the FIRST
 * message per field is kept — that is what those forms render.
 */
export function readApiFieldErrors(message: unknown): Record<string, string> {
  if (!message || typeof message !== 'object') return {}

  const errors: Record<string, string> = {}
  for (const [field, value] of Object.entries(message as Record<string, unknown>)) {
    const first = Array.isArray(value)
      ? value.find((entry): entry is string => typeof entry === 'string')
      : typeof value === 'string'
        ? value
        : undefined
    if (first) errors[field] = first
  }
  return errors
}

/** The useful parts of a thrown axios error, without depending on axios's own types. */
export function responseOf(error: unknown): { status?: number; data?: ApiEnvelope } | undefined {
  return (error as { response?: { status?: number; data?: ApiEnvelope } } | undefined)?.response
}

/**
 * Turns any thrown request error into a message that is SAFE to put on screen.
 *
 * The rules are the ones every Vite service already follows, and the reasoning matters:
 *
 *   - **No `response` at all** means a network failure, a timeout or an abort. There is no
 *     server message to show, and these must never read as an account problem.
 *   - **5xx bodies are never surfaced.** This backend can return a Django debug page or
 *     raw SQL in a 500, and the product service documents exactly that. A generic line
 *     goes out instead; the real body stays in the network tab for a developer.
 *   - **4xx bodies ARE surfaced**, because the contract states `message` is written for
 *     end users. A per-status fallback covers the case where the body carries none.
 *
 * No token, credential or token content is ever included in the returned string.
 */
export function readApiError(error: unknown, fallback: string): string {
  const response = responseOf(error)

  if (!response) {
    return 'Unable to connect to the server. Check your connection and try again.'
  }

  const { status } = response

  if (status && status >= 500) {
    return 'The server is temporarily unavailable. Please try again shortly.'
  }

  const message = readApiMessage(response.data?.message, '')
  if (message) return message

  switch (status) {
    case 401:
      return 'Your session has expired. Please sign in again.'
    case 403:
      return 'You do not have permission to do that.'
    case 404:
      return 'That could not be found.'
    case 409:
      return 'That conflicts with something that already exists.'
    case 429:
      return 'Too many requests. Please try again in a moment.'
    default:
      return fallback
  }
}

/** True when the backend answered 404 — "this resource is gone", not "the request failed". */
export function isNotFound(error: unknown): boolean {
  return responseOf(error)?.status === 404
}

/** True when the backend refused the credential (or the lack of one). */
export function isUnauthenticated(error: unknown): boolean {
  const status = responseOf(error)?.status
  return status === 401 || status === 403
}
