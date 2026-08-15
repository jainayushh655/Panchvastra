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
  // Keep requests relative so Vite proxy can route them
  // to the local Django backend during development.
  baseURL: "",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = readStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;