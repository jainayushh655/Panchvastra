/// <reference types="vite/client" />

interface ImportMetaEnv {
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
