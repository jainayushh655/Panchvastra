import api from './axios'
import type { UserProfileDto } from '@/types/api/UserProfileDto'

/**
 * User Profile API.
 *
 * VERIFIED LIVE against /v1/user_profile/:
 *   - The endpoint exists and is authentication-gated: unauthenticated GET and PUT both
 *     return 401 {"success": false, "message": "Authorization token missing.", "data": {}}
 *     (a request to a non-existent path returns 404, so 401 confirms the route is real).
 *     A malformed bearer returns 401 {"success": false, "message": "Invalid authentication
 *     token.", "error": "...", "data": {}}.
 *   - The backend publishes an OpenAPI schema at /api/schema/. It defines GET (Get profile)
 *     and PUT (Update profile) only, and the PUT body as multipart/form-data using
 *     `UpdateUserProfileRequest`: first_name, last_name, mobile, date_of_birth (format
 *     date, nullable), gender (GenderEnum: Male | Female | Other, nullable) and
 *     profile_image (binary). There is no email field.
 *
 * NOT VERIFIED: the authenticated 2xx payloads. Signing in requires an OTP emailed to a
 * real account, so no authenticated session could be established from this environment,
 * and the schema documents both responses as "No response body". The reader below follows
 * this backend's confirmed `{ success, message, data }` envelope and additionally tolerates
 * a flat payload, so an unexpected wrapper degrades to empty fields rather than crashing.
 *
 * Auth headers, base URL and interceptors all come from the shared `api` client — no new
 * HTTP layer and no separate token. Profile and Address are separate resources and their
 * requests are never combined.
 */

type ProfileEnvelope<T> = {
  success?: boolean
  message?: string | Record<string, string[]>
  data?: T
}

const PROFILE_FIELDS = ['first_name', 'last_name', 'email', 'mobile', 'date_of_birth', 'gender', 'profile_image']

/** Flattens this backend's two `message` shapes (string, or field→messages) into one line. */
export function readProfileApiMessage(message: unknown, fallback: string): string {
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

/** Turns any thrown request error into a user-safe message (never a raw stack/trace). */
export function readProfileApiError(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: ProfileEnvelope<unknown> } }).response

  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const status = response.status
  if (status === 401 || status === 403) return 'Your session has expired. Please sign in again.'
  if (status === 404) return 'Your profile could not be found.'
  if (status === 413) return 'That image is too large. Please choose a smaller file.'
  if (status && status >= 500) return 'The server is temporarily unavailable. Please try again shortly.'

  return readProfileApiMessage(response.data?.message, fallback)
}

/** Picks the profile object out of `data`, or out of a flat/nested payload. */
function readProfile(payload: ProfileEnvelope<unknown> | undefined): UserProfileDto {
  const candidates: unknown[] = [payload?.data, payload]

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const record = candidate as Record<string, unknown>
    if (PROFILE_FIELDS.some((field) => field in record)) return record as UserProfileDto

    // One level of nesting (e.g. `data: { user: {...} }`).
    for (const value of Object.values(record)) {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const nested = value as Record<string, unknown>
        if (PROFILE_FIELDS.some((field) => field in nested)) return nested as UserProfileDto
      }
    }
  }

  return {}
}

/** GET /v1/user_profile/ — the authenticated user's profile. */
export async function getProfile(): Promise<UserProfileDto> {
  const response = await api.get<ProfileEnvelope<unknown>>('/v1/user_profile/')
  return readProfile(response.data)
}

/**
 * PUT /v1/user_profile/ — multipart/form-data, per the published contract.
 *
 * `Content-Type` is explicitly unset so the browser generates the multipart boundary; the
 * shared client's JSON default would otherwise make the body unparseable. The PUT response
 * is not trusted as the new state — callers re-fetch with `getProfile()`.
 */
export async function updateProfile(formData: FormData): Promise<void> {
  await api.put<ProfileEnvelope<unknown>>('/v1/user_profile/', formData, {
    headers: { 'Content-Type': undefined },
  })
}
