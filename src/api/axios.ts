import axios from "axios";
import { notifyRateLimited, readRetryAfterSeconds } from "./rateLimit";
import { notifySessionExpired } from "./sessionExpiry";

const AUTH_TOKEN_STORAGE_KEY = "pv_auth_token_v1";

/**
 * Header the backend adds to a PUBLIC GET answered for a guest because the token the
 * browser sent was expired or invalid. Value: "expired" | "invalid".
 *
 * This is the server telling us the stored session is dead WITHOUT failing the request —
 * the body is a perfectly good guest response and must still be rendered. Returned by the
 * public GETs of products, reviews, size charts and quantity discount tiers; CORS exposes
 * it.
 */
const AUTH_TOKEN_STATUS_HEADER = "x-auth-token-status";

function readStoredToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const token = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    return typeof token === "string" && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

/**
 * Endpoints whose 401 is the CALLER's to handle, never a reason to end the session.
 *
 * Two groups, for two different reasons.
 *
 * Sign-in endpoints: "Invalid email or password", a wrong OTP and a rejected Google
 * credential all arrive as 401 here. Treating those as an expired session would clear the
 * (non-existent) session and bounce the visitor back to the login screen they are already
 * on — a redirect loop that hides the message explaining what went wrong.
 *
 * Payment and order endpoints: these are non-idempotent POSTs where money or an order may
 * already have moved. Signing someone out in the middle of one would drop them out of
 * checkout at the worst possible moment, and would set up exactly the replay-after-login
 * hazard that must not happen. The checkout screen already shows a deliberate message for
 * a 401 on each of these, and that handling is left in charge.
 */
const CALLER_HANDLED_401 = [
  // Sign-in
  "/v1/login_user/",
  "/v1/register_user/",
  "/v1/verify_email/",
  "/v1/google_login/",
  "/v1/login_admin/",
  // Payment / order placement
  "/v1/checkout_payment/",
  "/v1/verify_payment_api/",
  "/v1/cod_order/",
];

function isCallerHandled(url: string | undefined): boolean {
  if (!url) return false;
  return CALLER_HANDLED_401.some((path) => url.includes(path));
}

/**
 * Reads `X-Auth-Token-Status` off a response, whatever shape the header bag is in.
 *
 * Axios normally gives a plain lowercase-keyed object, but an `AxiosHeaders` instance
 * exposes `get()` instead, and a response that came back through a proxy can carry the
 * canonical casing. All three are handled rather than assuming one.
 */
function readTokenStatus(headers: unknown): string | null {
  if (!headers || typeof headers !== "object") return null;

  const bag = headers as Record<string, unknown> & { get?: (name: string) => string | null };
  const raw =
    (typeof bag.get === "function" ? bag.get(AUTH_TOKEN_STATUS_HEADER) : undefined) ??
    bag[AUTH_TOKEN_STATUS_HEADER] ??
    bag["X-Auth-Token-Status"];

  return typeof raw === "string" && raw.trim() ? raw.trim().toLowerCase() : null;
}

/**
 * The stored token was rejected, but the request SUCCEEDED as a guest.
 *
 * Clearing the session is all that happens, and that is the whole point: the response in
 * hand is valid guest content, so the page renders normally and the shopper simply becomes
 * logged-out. No error, no toast, no redirect — a product page must never interrupt
 * browsing to announce that a background token went stale.
 *
 * It reuses the same signal an expired protected call raises, so there is exactly one
 * logout path in the app: `AuthProvider` clears state and storage, and the existing route
 * guards move the visitor only if they were on a protected page. The one-shot latch in
 * `sessionExpiry` means a page firing five public GETs at once still logs out once.
 *
 * Guarded on a token actually being stored — without one there is nothing to clear and
 * the header is just noise from a stale browser cache.
 */
function handleTokenStatusHeader(headers: unknown): void {
  const status = readTokenStatus(headers);
  if (!status) return;
  if (!readStoredToken()) return;

  notifySessionExpired();
}

api.interceptors.request.use((config) => {
  // A caller that supplied its own Authorization header wins — admin-only endpoints pass
  // the admin token explicitly, and the customer token must never overwrite it.
  if (config.headers.Authorization) {
    return config;
  }

  const token = readStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * Session-expiry handling.
 *
 * The ONLY thing this does is raise a signal; it never navigates and never writes to
 * storage. `AuthProvider` subscribes, clears the session, and the existing route guards
 * then move the user to the login screen with their return path — which is why no routing
 * logic is duplicated here.
 *
 * It fires for a 401 and nothing else:
 *   - 403 is left alone. It means "signed in but not allowed", which the screens already
 *     handle; logging someone out for it would be wrong and would hide the real problem.
 *   - Network failures, timeouts and aborted requests have no `response` at all, so they
 *     fall straight through. A flaky connection must never sign anyone out.
 *   - 429 is the rate limiter, not the session — it raises its own signal instead.
 *   - 5xx is the server's problem, not the session's.
 *   - A 401 on a login/OTP/Google endpoint is that form's own error message.
 *   - A 401 with no stored token is a public endpoint refusing an anonymous caller. There
 *     is nothing to clear, and clearing would be a no-op that still triggers a redirect.
 *
 * Separately, ANY response — success or failure — carrying `X-Auth-Token-Status` clears
 * the session silently; see `handleTokenStatusHeader`.
 *
 * Every error is re-thrown unchanged either way, so each caller's existing error handling —
 * including its own 401 wording — keeps working exactly as before.
 */
api.interceptors.response.use(
  (response) => {
    // A 2xx can still report a dead token: public GETs now answer as guest instead of 401.
    handleTokenStatusHeader(response.headers);
    return response;
  },
  (error) => {
    const response = (error as { response?: { status?: number; headers?: unknown } })?.response;
    const status = response?.status;
    const url = (error as { config?: { url?: string } })?.config?.url;

    // Checked before anything else: a failed request can still carry the header, and the
    // session is dead either way.
    handleTokenStatusHeader(response?.headers);

    if (status === 429) {
      notifyRateLimited(readRetryAfterSeconds(response?.headers));
      return Promise.reject(error);
    }

    if (status === 401 && !isCallerHandled(url) && readStoredToken()) {
      notifySessionExpired();
    }

    return Promise.reject(error);
  },
);

export default api;
