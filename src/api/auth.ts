import api from './axios'

import type {
  RegisterRequestDto,
  RegisterResponseDto,
} from '@/types/api/RegisterDto'
import type {
  GoogleLoginRequestDto,
  GoogleLoginResponseDto,
} from '@/types/api/GoogleLoginDto'

type AuthApiResponse = {
  success?: boolean
  message?: string
  token?: string | null
}

export async function registerUser(payload: RegisterRequestDto) {
  const response = await api.post<RegisterResponseDto>(
    '/v1/register_user/',
    payload
  )
  return response.data
}

export async function loginUser(payload: { email: string }) {
  const response = await api.post<AuthApiResponse>(
    '/v1/login_user/',
    payload
  )
  return response.data
}

export async function verifyEmail(payload: { email: string; otp: string }) {
  const response = await api.post<AuthApiResponse>(
    '/v1/verify_email/',
    payload
  )
  return response.data
}

/* ----------------------------------------------------------------- Google sign-in */

/**
 * POST /v1/google_login/ — exchanges a Google ID token for a Panchvastra session.
 *
 * Sends ONLY `{ credential }`. The shared axios client is reused, so no second client and
 * no manual Authorization header: the endpoint needs none, and the interceptor's automatic
 * customer token is harmless on an unauthenticated call.
 *
 * The HTTP status is returned alongside the body because it carries meaning here — 200 is
 * an existing account, 201 a newly created one — and axios throws for everything else.
 */
export async function loginWithGoogle(credential: string) {
  const body: GoogleLoginRequestDto = { credential }
  const response = await api.post<GoogleLoginResponseDto>('/v1/google_login/', body)
  return { status: response.status, data: response.data }
}

/**
 * Turns a failed Google sign-in into a message that is safe to show.
 *
 * Statuses where the backend's own wording is the useful part (403 deactivated/unverified/
 * admin, 409 already linked to another Google account) surface `message` verbatim. The rest
 * get fixed copy so an internal detail, a stack trace or a hint about which accounts exist
 * can never reach the customer. No token, credential or token contents are ever included.
 */
export function readGoogleLoginError(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: unknown } }).response
  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const backendMessage = readApiMessage(response.data)

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

/**
 * Reads `message` from an error body.
 *
 * This backend sends `message` as a string, or as an object of field -> string[] on
 * validation errors; the object form is flattened to one line so React is never handed an
 * object to render.
 */
function readApiMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const message = (data as { message?: unknown }).message

  if (typeof message === 'string') return message.trim()

  if (message && typeof message === 'object') {
    const parts: string[] = []
    for (const entry of Object.values(message as Record<string, unknown>)) {
      if (Array.isArray(entry)) parts.push(...entry.filter((v): v is string => typeof v === 'string'))
      else if (typeof entry === 'string') parts.push(entry)
    }
    if (parts.length) return parts.join(' ')
  }

  return ''
}