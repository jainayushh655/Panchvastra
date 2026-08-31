import api from './axios'

/**
 * Admin authentication against the real backend.
 *
 * VERIFIED CONTRACT (observed live against POST /v1/login_admin/):
 *   400 → {"success":false,"message":{"email":["This field is required."],
 *                                     "password":["This field is required."]},"data":{}}
 *   401 → {"success":false,"message":"Invalid email or password."}
 *   405 → returned for GET, so the endpoint is POST-only.
 * Note `message` is a STRING on 401 but an OBJECT of field errors on 400 — both are handled.
 *
 * NOT VERIFIED: the success (2xx) body. No valid admin credentials and no admin
 * registration endpoint exist in this environment, so a successful login could not be
 * executed to observe its shape. Rather than assert a token field name, `extractToken`
 * looks for the token in the envelope positions this backend is actually known to use
 * and returns null otherwise — and the caller then REFUSES the login. Auth fails closed:
 * a response we cannot read a token out of never grants admin access.
 */

/** The `{ success, message, data }` envelope used by every endpoint on this backend. */
export type AdminLoginResponse = {
  success?: boolean
  /** String for auth failures; field→messages object for validation failures. */
  message?: string | Record<string, string[]>
  token?: string | null
  access?: string | null
  data?: {
    token?: string | null
    access?: string | null
    refresh?: string | null
    admin?: { id?: number; email?: string; name?: string } | null
    user?: { id?: number; email?: string; name?: string } | null
  } | null
}

export type AdminLoginResult =
  | { ok: true; token: string; email: string | null }
  | { ok: false; message: string }

/** Flattens this backend's two `message` shapes into one displayable string. */
export function readApiMessage(message: unknown, fallback: string): string {
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
 * Pulls the auth token out of the login response. Checks `data.access` / `data.token` /
 * top-level `token` / top-level `access` — the positions this backend uses elsewhere
 * (resource endpoints nest payloads under `data`; the customer auth endpoint returns a
 * top-level `token`). Returns null when none is present, which the caller treats as a
 * failed login rather than a success.
 */
function extractToken(body: AdminLoginResponse | undefined | null): string | null {
  const candidates = [body?.data?.access, body?.data?.token, body?.token, body?.access]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return null
}

function extractEmail(body: AdminLoginResponse | undefined | null): string | null {
  const email = body?.data?.admin?.email ?? body?.data?.user?.email
  return typeof email === 'string' && email.trim() ? email.trim() : null
}

function messageForStatus(status: number | undefined, body: AdminLoginResponse | undefined): string {
  switch (status) {
    case 400:
      return readApiMessage(body?.message, 'Please enter a valid email and password.')
    case 401:
    case 403:
      return readApiMessage(body?.message, 'Invalid email or password.')
    case 404:
      return readApiMessage(body?.message, 'Admin account not found.')
    case 429:
      return 'Too many sign-in attempts. Please wait a moment and try again.'
    case 500:
    case 502:
    case 503:
    case 504:
      return 'The server is temporarily unavailable. Please try again shortly.'
    default:
      return readApiMessage(body?.message, 'Unable to sign in. Please try again.')
  }
}

/**
 * POST /v1/login_admin/ using the shared API client (base URL, headers and interceptors
 * are inherited — no new HTTP layer, no hardcoded URL). The password is passed straight
 * to the request and is never stored or logged.
 */
export async function loginAdmin(email: string, password: string): Promise<AdminLoginResult> {
  try {
    const response = await api.post<AdminLoginResponse>('/v1/login_admin/', { email, password })
    const body = response.data

    if (body?.success === false) {
      return { ok: false, message: readApiMessage(body?.message, 'Invalid email or password.') }
    }

    const token = extractToken(body)
    if (!token) {
      // Fail closed: never grant admin access from a response we cannot read a token from.
      return {
        ok: false,
        message: 'Signed in, but the server did not return an admin session token. Please contact support.',
      }
    }

    return { ok: true, token, email: extractEmail(body) }
  } catch (error) {
    const response = (error as { response?: { status?: number; data?: AdminLoginResponse } }).response

    if (!response) {
      return { ok: false, message: 'Unable to connect to the server. Check your connection and try again.' }
    }

    return { ok: false, message: messageForStatus(response.status, response.data) }
  }
}
