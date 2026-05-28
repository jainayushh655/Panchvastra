import { CMS_STORAGE_KEYS } from '@/cms/registry'

const TOKEN = import.meta.env.VITE_ADMIN_TOKEN ?? 'pv-admin-demo'

export function adminTokenConfigured() {
  return TOKEN.length > 0
}

export function validateAdmin(pin: string) {
  return pin === TOKEN
}

export function adminSessionOk() {
  return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(CMS_STORAGE_KEYS.adminSession) === '1'
}

export function setAdminSession() {
  sessionStorage.setItem(CMS_STORAGE_KEYS.adminSession, '1')
}

export function clearAdminSession() {
  sessionStorage.removeItem(CMS_STORAGE_KEYS.adminSession)
}
