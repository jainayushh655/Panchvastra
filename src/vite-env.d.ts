/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Origin of the DJANGO backend, used as the axios `baseURL` for every `/v1/...` call.
   *
   * Unset means SAME ORIGIN, which is correct in development — `vite.config.ts` proxies
   * `/v1` to https://api.panchvastra.com. In production it is only correct if the host
   * serving this bundle also serves `/v1`: `vercel.json` rewrites everything except
   * `/api/` to `index.html`, so on a Vercel deployment with this unset, every API call is
   * answered with the HTML page instead of JSON.
   *
   * It was being read in three files while being documented in none, which is how that
   * stays invisible until a deploy. Set it in the Vercel project's environment variables
   * if the frontend and the API are on different hosts.
   */
  readonly VITE_API_BASE_URL?: string
  /** Origin of the local Express catalog/orders API (`/api/...`). Separate from the Django backend above. */
  readonly VITE_API_URL?: string
  /** Admin panel password demo default: pv-admin-demo */
  readonly VITE_ADMIN_TOKEN?: string
  /** WhatsApp business number with country code, digits only (e.g. 919876543210). Used after checkout. */
  readonly VITE_WHATSAPP_NUMBER?: string
  /** Full Instagram profile URL (defaults to instagram.com/panchvastra). */
  readonly VITE_INSTAGRAM_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
