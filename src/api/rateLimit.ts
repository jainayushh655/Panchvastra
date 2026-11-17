/**
 * One coordinated signal for "the backend is rate-limiting us" (HTTP 429).
 *
 * Shaped exactly like `sessionExpiry.ts`, and for the same reason: the shared axios client
 * cannot render a toast or touch React state, and importing a provider here would be a
 * cycle. So the interceptor raises a signal and a tiny subscriber inside `ToastProvider`
 * turns it into the message the shopper sees.
 *
 * Limits are per user when signed in and per IP for guests, so a 429 is a normal thing to
 * hit from a shared network — it is never an error state for the page, just a "slow down".
 *
 * NOTHING HERE RETRIES. That is deliberate: an automatic retry against a rate limiter is
 * how a single over-eager page turns into a retry storm that keeps the limit permanently
 * tripped. The shopper retries by acting again, after the window the server named.
 */

type Listener = (retryAfterSeconds: number | null) => void

const listeners = new Set<Listener>()

/**
 * Collapses a burst into ONE message.
 *
 * A page with several requests in flight trips the limit on all of them at once; without
 * this the shopper would get a stack of identical toasts. The latch clears itself after
 * the window the server asked for, so a later, genuinely separate 429 is announced again.
 */
let suppressUntil = 0

/** Reads `Retry-After`, which this backend sends as a whole number of seconds. */
export function readRetryAfterSeconds(headers: unknown): number | null {
  if (!headers || typeof headers !== 'object') return null

  // Axios lowercases response header keys, but a raw `Headers` object or a proxy may not.
  const bag = headers as Record<string, unknown> & { get?: (name: string) => string | null }
  const raw =
    (typeof bag.get === 'function' ? bag.get('retry-after') : undefined) ??
    bag['retry-after'] ??
    bag['Retry-After']

  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.round(raw))
  if (typeof raw !== 'string') return null

  const seconds = Number(raw.trim())
  // `Retry-After` may also be an HTTP date; this backend sends seconds, but a date is
  // parsed rather than silently dropped.
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds))

  const asDate = Date.parse(raw)
  if (Number.isFinite(asDate)) return Math.max(0, Math.round((asDate - Date.now()) / 1000))

  return null
}

export function onRateLimited(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Called by the response interceptor for a 429, with whatever `Retry-After` carried. */
export function notifyRateLimited(retryAfterSeconds: number | null): void {
  const now = Date.now()
  if (now < suppressUntil) return

  // Suppress for the window the server named, bounded so a huge `Retry-After` cannot mute
  // the app for the rest of the session, and floored so a missing header still de-dupes.
  const windowSeconds = Math.min(Math.max(retryAfterSeconds ?? 5, 3), 60)
  suppressUntil = now + windowSeconds * 1000

  for (const listener of [...listeners]) {
    try {
      listener(retryAfterSeconds)
    } catch {
      // A failing subscriber must not stop the others from reporting.
    }
  }
}

/** Human wording for the toast. Falls back to a vague window when no header was sent. */
export function rateLimitMessage(retryAfterSeconds: number | null): string {
  if (retryAfterSeconds == null || retryAfterSeconds <= 0) {
    return 'Please try again in a few seconds.'
  }
  if (retryAfterSeconds < 60) {
    return `Please try again in ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'}.`
  }
  const minutes = Math.ceil(retryAfterSeconds / 60)
  return `Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}

/** Test seam — clears the de-duplication window. */
export function resetRateLimitLatch(): void {
  suppressUntil = 0
}
