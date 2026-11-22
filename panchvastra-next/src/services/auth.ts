/**
 * Authentication — the three calls the session provider makes.
 *
 * Ported from the Vite application's `src/api/auth.ts`, contracts unchanged:
 *   POST /v1/login_user/    `{ email }`          -> `{ success, message }`
 *   POST /v1/verify_email/  `{ email, otp }`     -> `{ success, message, token }`
 *   POST /v1/google_login/  `{ credential }`     -> `{ message, token, user }`, status 200|201
 *
 * `registerUser` is NOT here: it belongs to the sign-up screen, which is Phase 4. Only
 * what `AuthProvider` needs is ported, so Phase 3 adds no unused request surface.
 *
 * All three go through the shared client. A 401 from any of them is the FORM's own error
 * message, never a session expiry — they are on `CALLER_HANDLED_401` in `endpoints.ts`,
 * which is what stops the interceptor from signing anyone out mid sign-in.
 */

import api from '@/services/http/client'
import { ENDPOINTS } from '@/services/endpoints'
import { readApiMessage } from '@/services/http/apiMessage'
import type { GoogleLoginRequestDto, GoogleLoginResponseDto } from '@/types/api/GoogleLoginDto'

type AuthApiResponse = {
  success?: boolean
  message?: string
  token?: string | null
}

export async function loginUser(payload: { email: string }) {
  const response = await api.post<AuthApiResponse>(ENDPOINTS.loginUser, payload)
  return response.data
}

export async function verifyEmail(payload: { email: string; otp: string }) {
  const response = await api.post<AuthApiResponse>(ENDPOINTS.verifyEmail, payload)
  return response.data
}

/**
 * POST /v1/google_login/ — exchanges a Google ID token for a Panchvastra session.
 *
 * Sends ONLY `{ credential }`. The HTTP status is returned alongside the body because it
 * carries meaning here: 200 is an existing account, 201 a newly created one. Axios throws
 * for everything else.
 */
export async function loginWithGoogle(credential: string) {
  const body: GoogleLoginRequestDto = { credential }
  const response = await api.post<GoogleLoginResponseDto>(ENDPOINTS.googleLogin, body)
  return { status: response.status, data: response.data }
}

/**
 * Turns a failed Google sign-in into a message that is safe to show.
 *
 * Statuses where the backend's own wording is the useful part (403 deactivated/unverified/
 * admin, 409 already linked to another Google account) surface `message` verbatim. The
 * rest get fixed copy so an internal detail, a stack trace or a hint about which accounts
 * exist can never reach the customer. No token, credential or token content is ever
 * included.
 *
 * The per-status table is reproduced exactly from the Vite implementation; only the
 * message flattener is shared (`readApiMessage`) instead of being a private copy.
 */
export function readGoogleLoginError(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: unknown } }).response
  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const backendMessage = readApiMessage((response.data as { message?: unknown } | undefined)?.message, '')

  switch (response.status) {
    case 400:
      // A missing/empty credential is our bug, not the customer's account.
      return backendMessage || 'Google sign-in could not be completed. Please try again.'
    case 401:
      return 'Google sign-in failed, please try again.'
    case 403:
    case 409:
      return backendMessage || fallback
    case 429:
      return 'Too many attempts, wait a minute.'
    case 503:
      // A missing backend Google config must never read as "your account is invalid".
      return 'Google sign-in is temporarily unavailable. Please try again later.'
    default:
      if (response.status && response.status >= 500) {
        return 'The server is temporarily unavailable. Please try again shortly.'
      }
      return backendMessage || fallback
  }
}
