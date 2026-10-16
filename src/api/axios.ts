import axios from "axios";
import { notifySessionExpired } from "./sessionExpiry";

const AUTH_TOKEN_STORAGE_KEY = "pv_auth_token_v1";

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
 *   - 429 and 5xx are the server's problem, not the session's.
 *   - A 401 on a login/OTP/Google endpoint is that form's own error message.
 *   - A 401 with no stored token is a public endpoint refusing an anonymous caller. There
 *     is nothing to clear, and clearing would be a no-op that still triggers a redirect.
 *
 * Every error is re-thrown unchanged either way, so each caller's existing error handling —
 * including its own 401 wording — keeps working exactly as before.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = (error as { response?: { status?: number } })?.response?.status;
    const url = (error as { config?: { url?: string } })?.config?.url;

    if (status === 401 && !isCallerHandled(url) && readStoredToken()) {
      notifySessionExpired();
    }

    return Promise.reject(error);
  },
);

export default api;