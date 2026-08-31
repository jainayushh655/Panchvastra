/**
 * Reads the payload of a JWT WITHOUT verifying it.
 *
 * This exists only so the UI can read the backend-issued role and decide what to render or
 * route to. It is NOT a security check: the signature is never validated here, and the
 * backend remains the sole authority on what an admin is actually permitted to do. Hiding
 * the admin UI is not access control — every admin endpoint must still enforce its own
 * permissions server-side.
 *
 * Returns null for anything that is not a readable three-part JWT.
 */
export function readJwtPayload(token: string | null | undefined): Record<string, unknown> | null {
  if (typeof token !== 'string') return null

  const parts = token.split('.')
  if (parts.length !== 3 || !parts[1]) return null

  try {
    // base64url -> base64, then re-pad to a multiple of 4 for atob().
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)

    // atob yields a byte string; walk it back through percent-encoding so multi-byte UTF-8
    // claims survive.
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''),
    )

    const parsed: unknown = JSON.parse(json)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}
