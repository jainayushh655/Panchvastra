/** Typed localStorage helpers */

export function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

export const KEYS = {
  cart: 'pv_cart_v2',
  wishlist: 'pv_wishlist_v2',
  users: 'pv_users_v1',
  currentUser: 'pv_current_user_v1',
} as const
