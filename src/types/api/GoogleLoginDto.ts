/**
 * Google sign-in contract for POST /v1/google_login/.
 *
 * Note this endpoint does NOT use the `{ success, message, data }` envelope the rest of
 * this backend uses — it returns the authentication payload at the top level, exactly as
 * the published contract shows. Success is therefore read from the HTTP status (200 for an
 * existing account, 201 for a newly created one), never from a `success` flag.
 *
 * The request carries ONLY the raw Google ID token. Email, name, picture and google_id are
 * deliberately absent: the backend derives them from the credential it verifies, so nothing
 * the browser could tamper with is trusted.
 */

export interface GoogleLoginRequestDto {
  credential: string
}

/** The user as this endpoint returns it. Wider than the session needs; read, never sent. */
export interface GoogleLoginUserDto {
  id: number
  role_id: number
  first_name: string | null
  last_name: string | null
  email: string
  /** Null for a brand-new Google account — Google never supplies a phone number. */
  mobile: string | null
  profile_image: string | null
  email_verified: boolean
}

export interface GoogleLoginResponseDto {
  message?: string
  /** The PANCHVASTRA JWT. Never the Google ID token. */
  token?: string | null
  user?: GoogleLoginUserDto
}
