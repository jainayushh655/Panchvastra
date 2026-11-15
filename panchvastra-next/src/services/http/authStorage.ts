/**
 * The one place browser session storage is touched.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE CENTRAL MIGRATION CONSTRAINT
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite application keeps its JWT in `localStorage` and reads it synchronously from an
 * axios request interceptor. Server Components cannot read `localStorage` — it does not
 * exist on the server — so every function in this file is a NO-OP when `window` is
 * undefined, and nothing here may ever be called from a Server Component expecting a
 * value back.
 *
 * Phase 2 keeps the localStorage model exactly as it is. That is deliberate: it makes
 * Phases 3 and 4 a mechanical port with zero authentication-behaviour risk. Authenticated
 * screens (cart, checkout, orders, profile, wishlist, all of admin) are Client Components,
 * which is what they already are in practice.
 *
 * The planned successor is a Route Handler that mirrors the same JWT into an `httpOnly`,
 * `secure`, `sameSite=lax` cookie, so Server Components can read it via `cookies()` and
 * `middleware.ts` can guard routes. That is Phase 5, as an isolated, separately-testable
 * change. This module is the seam it will slot into: swap `readToken` and nothing else
 * moves. Until then the keys, the validation and the cross-tab event stay byte-for-byte
 * what the Vite app uses, so the two applications can run side by side against the same
 * browser profile during migration testing without fighting over storage.
 *
 * NO SECRETS IN ENVIRONMENT VARIABLES. The token lives only here, in the browser, issued
 * by the backend. It is never read from, or written to, a `NEXT_PUBLIC_*` variable.
 */

/** Customer JWT. Same key the Vite app uses — intentionally, see above. */
export const AUTH_TOKEN_STORAGE_KEY = 'pv_auth_token_v1'

/** Serialised `AuthUser` (`{ id?, name?, email, roleId }`). */
export const CURRENT_USER_STORAGE_KEY = 'pv_current_user_v1'

/**
 * Mirror of the customer JWT, written ONLY for a user whose backend role is the admin
 * role, and removed for everyone else. `adminRequest.ts` reads this key so admin CRUD can
 * never pick up a shopper's token. See `adminRequest.ts` for why the mirror exists.
 */
export const ADMIN_TOKEN_STORAGE_KEY = 'panchvastra-admin-token'

/** Same-tab change signal. The Vite app dispatches this on every session write/clear. */
export const AUTH_EVENT = 'pv_auth_changed'

/**
 * Structural JWT check — three base64url segments separated by dots.
 *
 * This is NOT verification and is not pretending to be: signatures are checked by the
 * backend. It exists so a corrupted or hand-edited storage value is discarded on read
 * instead of being sent as a bearer token and bouncing every request with a 401.
 */
const JWT_PATTERN = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+$/

export function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

export function isValidJwt(token: string | null | undefined): token is string {
  return typeof token === 'string' && JWT_PATTERN.test(token.trim())
}

/**
 * Reads one key, tolerating a `localStorage` that throws.
 *
 * Storage access throws in Safari private mode and under some enterprise policies.
 * A throw here must degrade to "no session", never crash a render.
 */
function read(key: string): string | null {
  if (!isBrowser()) return null
  try {
    const value = window.localStorage.getItem(key)
    return typeof value === 'string' && value.trim() ? value.trim() : null
  } catch {
    return null
  }
}

function write(key: string, value: string): void {
  if (!isBrowser()) return
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage unavailable: callers fall back to in-memory state for this session.
  }
}

function remove(key: string): void {
  if (!isBrowser()) return
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Nothing to do — the value was already unreachable.
  }
}

/** The customer JWT, or null. Returns null on the server, always. */
export function readToken(): string | null {
  return read(AUTH_TOKEN_STORAGE_KEY)
}

/** The admin-mirrored JWT, or null. Never falls back to the customer token. */
export function readAdminToken(): string | null {
  return read(ADMIN_TOKEN_STORAGE_KEY)
}

/** The raw stored user JSON, left unparsed — the auth provider owns its shape. */
export function readStoredUserJson(): string | null {
  return read(CURRENT_USER_STORAGE_KEY)
}

/** Notifies this tab that the session changed. The provider listens for it. */
export function emitAuthChanged(): void {
  if (!isBrowser()) return
  try {
    window.dispatchEvent(new Event(AUTH_EVENT))
  } catch {
    // A missing Event constructor is not a reason to fail a sign-in.
  }
}

/**
 * Persists a session. Rejects a token that is not structurally a JWT by clearing instead,
 * so a bad write can never leave a half-session behind.
 */
export function writeSession(token: string, userJson: string): boolean {
  if (!isValidJwt(token)) {
    clearSession()
    return false
  }
  write(AUTH_TOKEN_STORAGE_KEY, token.trim())
  write(CURRENT_USER_STORAGE_KEY, userJson)
  emitAuthChanged()
  return true
}

/**
 * Clears the customer session.
 *
 * Touches the two auth keys and NOTHING else. The wishlist is stored per email under its
 * own key and must survive; the cart lives on the server and is re-read for whoever signs
 * in next. The admin mirror is removed by its own provider, which owns that key.
 */
export function clearSession(): void {
  remove(CURRENT_USER_STORAGE_KEY)
  remove(AUTH_TOKEN_STORAGE_KEY)
  emitAuthChanged()
}

/**
 * Writes or clears the admin mirror — idempotent, and only when the value actually
 * differs, so a double render under Strict Mode is a no-op.
 *
 * Pass the token for an admin-role user, or `null` for everyone else. The caller is
 * responsible for the role check; this function does not widen access on its own.
 */
export function syncAdminToken(token: string | null): void {
  if (!isBrowser()) return
  try {
    const current = window.localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)
    if (token) {
      if (current !== token) window.localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token)
    } else if (current !== null) {
      window.localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
    }
  } catch {
    // Storage unavailable: admin requests fail closed, which is the safe outcome.
  }
}
