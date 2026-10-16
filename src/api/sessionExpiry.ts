/**
 * One coordinated signal for "the stored session is no longer accepted".
 *
 * The shared axios client cannot clear React state or navigate on its own, and importing
 * the auth provider here would be a cycle. So the interceptor raises this signal and
 * `AuthProvider` subscribes to it — the same one-way shape the existing `pv_auth_changed`
 * window event already uses.
 *
 * It is deliberately a tiny module with no dependencies so it can be imported from both
 * the API layer and the provider layer without pulling anything else in.
 */

type Listener = () => void

const listeners = new Set<Listener>()

/**
 * Collapses a burst into ONE logout.
 *
 * A single page can have several authenticated requests in flight — cart, addresses, the
 * page's own data. When a token expires they all come back 401 at once. Without this
 * latch each one would clear the session and re-render the tree, and the user would see
 * the redirect fight itself. The latch opens again only after a successful sign-in.
 */
let alreadyNotified = false

export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Called by the response interceptor for a 401 that really means "expired/invalid". */
export function notifySessionExpired(): void {
  if (alreadyNotified) return
  alreadyNotified = true

  for (const listener of [...listeners]) {
    try {
      listener()
    } catch {
      // A failing subscriber must not stop the others from clearing their own state.
    }
  }
}

/** Re-arms the latch. Called when a new session is established, and on explicit logout. */
export function resetSessionExpiryLatch(): void {
  alreadyNotified = false
}

/** Test seam only — reports whether the latch is currently closed. */
export function isSessionExpiryLatched(): boolean {
  return alreadyNotified
}
