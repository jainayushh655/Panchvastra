/**
 * Shared authorization for admin-only API calls.
 *
 * Ported from the Vite application's `src/api/adminRequest.ts`, unchanged in behaviour.
 *
 * HOW ADMIN AUTH ACTUALLY WORKS HERE — worth reading before touching anything:
 *
 * There is ONE authentication system. An admin signs in through the same
 * `POST /v1/login_user/` -> `POST /v1/verify_email/` OTP flow as every customer. There is
 * no admin password, no admin OTP system and no second token. `POST /v1/login_admin/`
 * exists on the backend but the frontend stopped calling it.
 *
 * What makes someone an admin is AUTHORIZATION, not authentication: the backend-issued
 * `role_id` must equal 1. That value is read from the login response envelope, falling
 * back to the JWT's own claims, and an unreadable role resolves to `null` — which is
 * treated as "not an admin". Auth fails closed; it never default-allows.
 *
 * The admin session then MIRRORS the same JWT into its own storage key, and this helper
 * reads only that key. Two consequences, both intentional:
 *   - A signed-in shopper has no admin key, so a customer token can never reach an admin
 *     endpoint even by accident.
 *   - A missing admin session throws BEFORE any request is made, rather than sending an
 *     unauthenticated call and interpreting the 401.
 *
 * Hiding the admin UI is not access control. Every admin endpoint still enforces its own
 * permissions server-side, and this helper does not change that.
 */

import { ADMIN_TOKEN_STORAGE_KEY, readAdminToken } from './authStorage'

export { ADMIN_TOKEN_STORAGE_KEY }

/** Raised before any request when no admin session exists — fails closed, never falls back. */
export class MissingAdminSessionError extends Error {
  constructor() {
    super('Your admin session has expired. Please sign in again.')
    this.name = 'MissingAdminSessionError'
  }
}

/**
 * Authorization header for admin-only calls. Never consults the customer token, so a
 * signed-in shopper cannot reach admin endpoints.
 *
 * ⚠️ BROWSER ONLY — `readAdminToken` returns null on the server, so calling this from a
 * Server Component throws `MissingAdminSessionError`. Admin screens are Client
 * Components; that is by design, not an oversight.
 */
export function adminAuthConfig() {
  const token = readAdminToken()
  if (!token) throw new MissingAdminSessionError()

  return { headers: { Authorization: `Bearer ${token}` } }
}

/** True for the error `adminAuthConfig` throws, so callers can report it distinctly. */
export function isMissingAdminSession(error: unknown): boolean {
  return error instanceof MissingAdminSessionError
}
