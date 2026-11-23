/**
 * Where to send someone after they sign in.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SEPARATE, CAREFUL MODULE
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite app passes the return path through react-router's `location.state`, which is
 * in-memory and can only ever have been put there by the app's own guard. The App Router
 * has no equivalent, so the path travels in the URL as `?next=` — and that is a different
 * security proposition entirely: anyone can send a customer a link to
 *
 *     /login?next=https://evil.example/login
 *
 * and, if the value were used as given, the sign-in screen would bounce them to an
 * attacker's page immediately after they authenticate. That is an open-redirect, and it
 * is most damaging on exactly this screen, because the victim has just been asked to
 * trust it with a credential.
 *
 * So no value from the URL is ever navigated to unchecked. `safeNextPath` is the only way
 * a `next` value becomes a destination, and anything it does not positively recognise as
 * an internal path becomes the homepage.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT IS ACCEPTED
 * ──────────────────────────────────────────────────────────────────────────────
 * One shape only: a path on this site, beginning with a single `/`, optionally carrying a
 * query string and a fragment. `/product/3?sku=PV-3-OFF` survives intact, which is the
 * point — the guard records the full address, not just the route.
 *
 * WHAT IS REJECTED, and why each one is listed explicitly:
 *
 *   - `https://evil.example/x`  — an absolute URL. Another origin.
 *   - `//evil.example/x`        — PROTOCOL-RELATIVE. It looks like a path and is not: the
 *                                 browser reads it as "same scheme, THAT host". This is
 *                                 the one that slips through a naive `startsWith('/')`
 *                                 check, which is why it is tested for first.
 *   - `/\evil.example`          — the backslash variant. Browsers normalise `\` to `/` in
 *                                 URLs, so `/\host` behaves as `//host`.
 *   - `javascript:…`, `data:…`  — not paths at all; no leading `/`, so they fail anyway,
 *                                 but they are the reason the check is a whitelist rather
 *                                 than a blacklist of hosts.
 *   - `/login`, `/signup`       — internal, but bouncing back to the sign-in screen after
 *                                 signing in is a loop. These resolve to the homepage.
 *   - anything containing a control character, including an encoded newline, which can be
 *     used to smuggle a second value past a naive parser.
 *
 * The value is read ALREADY DECODED (that is what `useSearchParams().get()` returns), so
 * `%2F%2Fevil.example` has become `//evil.example` by the time it arrives and is caught
 * by the protocol-relative rule. It is deliberately not decoded a second time: decoding
 * twice is itself a way to sneak a `/` past a check.
 */

/** Where an absent, malformed or unsafe destination lands. */
export const DEFAULT_NEXT_PATH = '/'

/** Internal paths that must never be a post-login destination, to avoid a loop. */
const LOOPING_PATHS = new Set(['/login', '/signup'])

export function safeNextPath(raw: string | null | undefined): string {
  if (typeof raw !== 'string') return DEFAULT_NEXT_PATH

  const value = raw.trim()
  if (!value) return DEFAULT_NEXT_PATH

  // Control characters (including \n, \r and \t) never appear in a legitimate path here.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) return DEFAULT_NEXT_PATH

  // Must be a path on this site: exactly one leading slash.
  if (!value.startsWith('/')) return DEFAULT_NEXT_PATH

  // `//host` and `/\host` are both "another origin" in a browser, despite the leading `/`.
  if (value[1] === '/' || value[1] === '\\') return DEFAULT_NEXT_PATH

  /*
   * Final confirmation by the URL parser rather than by more string rules.
   *
   * Resolving the candidate against a throwaway base shows what a browser would ACTUALLY
   * do with it. If the result leaves that origin, the value was not the path it looked
   * like. This catches anything the explicit rules above have not thought of, which is
   * the case that matters: the rules cover what is known, this covers what is not.
   */
  let resolved: URL
  try {
    resolved = new URL(value, 'https://panchvastra.invalid')
  } catch {
    return DEFAULT_NEXT_PATH
  }

  if (resolved.origin !== 'https://panchvastra.invalid') return DEFAULT_NEXT_PATH

  if (LOOPING_PATHS.has(resolved.pathname)) return DEFAULT_NEXT_PATH

  // Rebuilt from the parsed URL, so what is returned is what the parser understood —
  // never the raw string with whatever the parser quietly ignored still in it.
  return `${resolved.pathname}${resolved.search}${resolved.hash}`
}
