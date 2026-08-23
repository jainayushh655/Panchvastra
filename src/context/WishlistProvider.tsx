import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/context/AuthProvider'

export type WishlistItem = {
  id: string
  name: string
  image: string
  price: number
  compareAtPrice?: number | null
}

type WishlistCtx = {
  items: WishlistItem[]
  count: number
  isWishlisted: (id: string) => boolean
  toggleWishlist: (item: WishlistItem) => void
  remove: (id: string) => void
}

const Ctx = createContext<WishlistCtx | null>(null)

function storageKey(email: string) {
  return `pv_wishlist_v1_${email}`
}

function readWishlist(email: string | null): WishlistItem[] {
  if (!email || typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(email))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * No wishlist/favorites backend endpoint exists (verified against the live API — every
 * candidate route returns a genuine 404, unlike auth-gated real endpoints which return 401).
 * This persists real user-added items to this browser only, scoped per signed-in account,
 * rather than fabricating a server-backed wishlist.
 */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const email = user?.email ?? null
  const [items, setItems] = useState<WishlistItem[]>(() => readWishlist(email))

  useEffect(() => {
    setItems(readWishlist(email))
  }, [email])

  useEffect(() => {
    if (!email || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(storageKey(email), JSON.stringify(items))
    } catch {
      // Ignore storage errors; wishlist stays in-memory for this session.
    }
  }, [items, email])

  const isWishlisted = useCallback((id: string) => items.some((i) => i.id === id), [items])

  const toggleWishlist = useCallback(
    (item: WishlistItem) => {
      if (!isAuthenticated) return
      setItems((prev) => (prev.some((i) => i.id === item.id) ? prev.filter((i) => i.id !== item.id) : [item, ...prev]))
    },
    [isAuthenticated],
  )

  const remove = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }, [])

  const value = useMemo(
    () => ({ items, count: items.length, isWishlisted, toggleWishlist, remove }),
    [items, isWishlisted, toggleWishlist, remove],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWishlist() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWishlist requires WishlistProvider')
  return ctx
}
