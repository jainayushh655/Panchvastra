import axios from "axios";
import { KEYS, readJson } from "@/lib/storage";

const api = axios.create({
  baseURL: "/v1",
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = readJson<string | null>(KEYS.authToken, null);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export default api;