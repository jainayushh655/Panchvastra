/**
 * Storage key for the admin session flag. Previously imported from `@/cms/registry`,
 * a module that does not exist in this repository — that dangling import was the sole
 * cause of the long-standing `npm run typecheck` failure. Inlined here so the module
 * type-checks without inventing a CMS layer.
 */
const ADMIN_SESSION_STORAGE_KEY = 'pv_admin_session'

const TOKEN = import.meta.env.VITE_ADMIN_TOKEN ?? 'pv-admin-demo'

export function adminTokenConfigured() {
  return TOKEN.length > 0
}

export function validateAdmin(pin: string) {
  return pin === TOKEN
}

export function adminSessionOk() {
  return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(ADMIN_SESSION_STORAGE_KEY) === '1'
}

export function setAdminSession() {
  sessionStorage.setItem(ADMIN_SESSION_STORAGE_KEY, '1')
}

export function clearAdminSession() {
  sessionStorage.removeItem(ADMIN_SESSION_STORAGE_KEY)
}

/** Same token the admin UI uses; sent as Bearer when saving catalog to `/api/catalog`. */
export function getAdminApiToken() {
  return TOKEN
}
