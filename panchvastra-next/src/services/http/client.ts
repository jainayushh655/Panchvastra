/**
 * The shared browser API client.
 *
 * Ported from the Vite application's `src/api/axios.ts`. The interceptor behaviour below
 * is reproduced exactly — it is the single most load-bearing piece of logic in the
 * frontend, and the migration audit flagged it as the thing most likely to break
 * invisibly. The only differences from the original are mechanical: the base URL comes
 * from `env`, the token from `authStorage`, and the 401 allow-list from `endpoints`,
 * instead of three literals inline.
 *
 * ⚠️ BROWSER ONLY. This client reads `localStorage` through `authStorage`. It must not be
 * imported into a Server Component. Server-side reads go through
 * `services/server/serverApi.ts`, which has no auth and no interceptors.
 *
 * Why axios and not `fetch`: twenty service modules, eight bespoke error readers, the
 * multipart contracts and this 401 policy are all built on it and verified against the
 * live backend. Re-expressing that in `fetch` would put every one of those contracts at
 * risk for no user-visible gain. The audit's recommendation was to keep it.
 */

import axios from 'axios'
import { env } from '@/lib/env'
import { CALLER_HANDLED_401 } from '@/services/endpoints'
import { readToken } from './authStorage'
import { notifySessionExpired } from './sessionExpiry'

/** Matches the Vite client. Long enough for a slow mobile network, short enough to fail. */
const REQUEST_TIMEOUT_MS = 15_000

const api = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    'Content-Type': 'application/json',
  },
})

function isCallerHandled(url: string | undefined): boolean {
  if (!url) return false
  return CALLER_HANDLED_401.some((path) => url.includes(path))
}

api.interceptors.request.use((config) => {
  // A caller that supplied its own Authorization header wins — admin-only endpoints pass
  // the admin token explicitly, and the customer token must never overwrite it.
  if (config.headers.Authorization) {
    return config
  }

  const token = readToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

/**
 * Session-expiry handling.
 *
 * The ONLY thing this does is raise a signal; it never navigates and never writes to
 * storage. The auth provider subscribes, clears the session, and the route guards then
 * move the user to the login screen with their return path — which is why no routing
 * logic is duplicated here.
 *
 * It fires for a 401 and nothing else:
 *   - 403 is left alone. It means "signed in but not allowed", which the screens already
 *     handle; logging someone out for it would be wrong and would hide the real problem.
 *   - Network failures, timeouts and aborted requests have no `response` at all, so they
 *     fall straight through. A flaky connection must never sign anyone out.
 *   - 429 and 5xx are the server's problem, not the session's.
 *   - A 401 on a login/OTP/Google endpoint is that form's own error message.
 *   - A 401 on a payment or order-placement POST is left to checkout, because money may
 *     already have moved and a forced sign-out there creates a replay hazard.
 *   - A 401 with no stored token is a public endpoint refusing an anonymous caller. There
 *     is nothing to clear, and clearing would be a no-op that still triggers a redirect.
 *
 * Every error is re-thrown unchanged either way, so each caller's existing error handling
 * — including its own 401 wording — keeps working exactly as before.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = (error as { response?: { status?: number } })?.response?.status
    const url = (error as { config?: { url?: string } })?.config?.url

    if (status === 401 && !isCallerHandled(url) && readToken()) {
      notifySessionExpired()
    }

    return Promise.reject(error)
  },
)

export default api

/**
 * A bare client with NO auth interceptor, for endpoints that must be read anonymously.
 *
 * Exactly one endpoint needs this today: `GET /v1/custom_options/` changes its response
 * for a privileged token, so the storefront read must not carry the shopper's bearer
 * token — otherwise a signed-in visitor would see a different set of options from a
 * signed-out one. Sharing `api` and deleting the header per-request is not equivalent,
 * because the interceptor would still have run.
 *
 * Same base URL and timeout, so there is no second HTTP configuration to keep in step.
 */
export const publicApi = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: REQUEST_TIMEOUT_MS,
})
