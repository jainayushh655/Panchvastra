'use client'

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

function writeWishlist(email: string, items: WishlistItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(storageKey(email), JSON.stringify(items))
  } catch {
    // Ignore storage errors; wishlist stays in-memory for this session.
  }
}

/**
 * The wishlist.
 *
 * No wishlist/favorites backend endpoint exists (verified against the live API — every
 * candidate route returns a genuine 404, unlike auth-gated real endpoints which return
 * 401). This persists real user-added items to this browser only, scoped per signed-in
 * account, rather than fabricating a server-backed wishlist. Same key, same shape and
 * same per-email scoping as the Vite application, so a browser profile carries its
 * wishlist between the two apps during migration testing.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THE STATE IS KEYED BY EMAIL, AND WHY THAT IS NOT COSMETIC
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite version holds `items` alone and has two effects: one that re-reads storage
 * when the email changes, one that writes `items` back whenever `items` or the email
 * changes. That is safe there ONLY because its `AuthProvider` resolves the email
 * synchronously during the first render, so the email never transitions from null to a
 * value while `items` is stale.
 *
 * In Next it does. The session is restored after mount (see `AuthProvider`), so the email
 * goes `null -> "someone@example.com"` on a later render. Ported verbatim, both effects
 * would run in that same commit: the read effect SCHEDULES the stored items, while the
 * write effect runs immediately with `items` still `[]` and the new email — and
 * overwrites the stored wishlist with an empty array. A signed-in visitor would lose
 * their saved items on every page load, silently.
 *
 * Holding `{ email, items }` as one value fixes it structurally rather than with a
 * timing guard: the write effect refuses to persist until the items in state are the ones
 * that were loaded FOR the current email, so there is no commit in which an empty list
 * can be attributed to a signed-in account.
 */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const email = user?.email ?? null

  // `loadedFor` is the account `items` belongs to. Both start empty, which is what the
  // server renders, so the count badge hydrates without a mismatch.
  const [state, setState] = useState<{ loadedFor: string | null; items: WishlistItem[] }>({
    loadedFor: null,
    items: [],
  })

  useEffect(() => {
    setState((current) =>
      current.loadedFor === email ? current : { loadedFor: email, items: readWishlist(email) },
    )
  }, [email])

  useEffect(() => {
    if (!email || state.loadedFor !== email) return
    writeWishlist(email, state.items)
  }, [state, email])

  const items = state.items

  const isWishlisted = useCallback((id: string) => items.some((i) => i.id === id), [items])

  const toggleWishlist = useCallback(
    (item: WishlistItem) => {
      if (!isAuthenticated) return
      setState((current) => ({
        ...current,
        items: current.items.some((i) => i.id === item.id)
          ? current.items.filter((i) => i.id !== item.id)
          : [item, ...current.items],
      }))
    },
    [isAuthenticated],
  )

  const remove = useCallback((id: string) => {
    setState((current) => ({ ...current, items: current.items.filter((i) => i.id !== id) }))
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
