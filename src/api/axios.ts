import axios from "axios";

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

export default api;