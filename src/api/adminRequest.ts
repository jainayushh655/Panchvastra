/**
 * Shared authorization for admin-only API calls.
 *
 * The admin session has its own storage key, separate from the customer token the shared
 * axios interceptor attaches. Admin endpoints pass this config explicitly so the customer
 * token can never reach them, and a missing admin session fails closed before any request
 * is made.
 *
 * Extracted from the coupon service so admin CRUD has exactly one auth implementation.
 */

const ADMIN_TOKEN_STORAGE_KEY = 'panchvastra-admin-token'

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
 */
export function adminAuthConfig() {
  let token: string | null
  try {
    token = typeof window === 'undefined' ? null : window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
  } catch {
    token = null
  }

  const trimmed = typeof token === 'string' ? token.trim() : ''
  if (!trimmed) throw new MissingAdminSessionError()

  return { headers: { Authorization: `Bearer ${trimmed}` } }
}
