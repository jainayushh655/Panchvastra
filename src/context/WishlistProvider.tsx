import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  addToWishlist,
  getWishlistProductIds,
  isWishlistUnavailable,
  readWishlistApiError,
  removeFromWishlist,
} from '@/api/wishlist'
import { useAuth } from '@/context/AuthProvider'

/**
 * Wishlist state, backed by the real `/v1/wishlist/` API.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED, AND WHY THE SHAPE IS DIFFERENT
 * ──────────────────────────────────────────────────────────────────────────────
 * This used to be a `localStorage` wishlist keyed by email, because no wishlist endpoint
 * existed — the old implementation said so explicitly. One now does, so the wishlist is
 * server state: it follows the account across devices, and the browser is no longer the
 * source of truth.
 *
 * The context now holds a Set of PRODUCT IDS rather than a list of product records. That
 * is the shape every consumer actually needs: a heart on a shop card, a PDP or a cart row
 * is asking "is this product saved?", which is a membership test. Product records for the
 * wishlist PAGE come from its own paginated read — carrying them in global state would
 * mean holding the whole wishlist in memory to answer a yes/no question, and would go
 * stale against page two.
 *
 * The ids are fetched once per session via `?ids_only=true`, not page by page, so a heart
 * on the 40th shop card is correct without paging the wishlist to find out.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * OPTIMISTIC TOGGLING
 * ──────────────────────────────────────────────────────────────────────────────
 * A heart flips immediately and rolls back if the request fails. A tap must feel
 * instant, and the failure case is rare enough that paying a round-trip of latency on
 * every tap to avoid it is the wrong trade.
 *
 * `inFlight` guards against double-taps on the same product: without it, two toggles
 * racing could leave the stored state disagreeing with the server, with the loser's
 * rollback undoing the winner's result.
 */

/** Product id the shopper tried to save while signed out, replayed after they sign in. */
const PENDING_WISHLIST_KEY = 'pv_pending_wishlist_product'

export type WishlistToggleResult =
  /** The toggle completed. `wishlisted` is the product's new state. */
  | { ok: true; wishlisted: boolean }
  /** No session. The caller should send the visitor to sign in; the intent is remembered. */
  | { ok: false; reason: 'auth' }
  /** The request failed and the optimistic change has already been rolled back. */
  | { ok: false; reason: 'error'; message: string }

type WishlistCtx = {
  /** Saved product ids. Empty for a guest. */
  ids: ReadonlySet<number>
  /** Header badge count. */
  count: number
  /** True during the initial id fetch, so a heart can avoid flashing "not saved". */
  loading: boolean
  isWishlisted: (productId: string | number) => boolean
  /** True while THIS product has a toggle in flight, for a per-button busy state. */
  isPending: (productId: string | number) => boolean
  toggle: (productId: string | number) => Promise<WishlistToggleResult>
  /** Explicit removal, used by the wishlist page's remove button. */
  remove: (productId: string | number) => Promise<WishlistToggleResult>
  /** Re-reads the ids. Called after the wishlist page mutates its own list. */
  refresh: () => Promise<void>
}

const Ctx = createContext<WishlistCtx | null>(null)

/** Product ids are numeric on the wire; consumers hold them as strings in places. */
function toProductId(value: string | number): number | null {
  const id = typeof value === 'number' ? value : Number(String(value).trim())
  return Number.isFinite(id) && id > 0 ? id : null
}

function readPendingProductId(): number | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(PENDING_WISHLIST_KEY)
    return raw ? toProductId(raw) : null
  } catch {
    return null
  }
}

function writePendingProductId(productId: number | null): void {
  if (typeof window === 'undefined') return
  try {
    if (productId == null) window.sessionStorage.removeItem(PENDING_WISHLIST_KEY)
    else window.sessionStorage.setItem(PENDING_WISHLIST_KEY, String(productId))
  } catch {
    // Storage unavailable — the shopper just taps the heart again after signing in.
  }
}

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, token } = useAuth()

  const [ids, setIds] = useState<ReadonlySet<number>>(() => new Set<number>())
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<ReadonlySet<number>>(() => new Set<number>())

  /** Guards against a slow earlier fetch overwriting a newer one (sign out, sign in). */
  const requestId = useRef(0)
  /** Synchronous double-tap guard — state updates are not applied in time to use. */
  const inFlight = useRef(new Set<number>())

  const load = useCallback(async () => {
    if (!token) {
      // Signing out empties the wishlist in the UI immediately. Nothing is deleted
      // server-side; the next sign-in re-reads it.
      setIds(new Set<number>())
      setLoading(false)
      return
    }

    const current = ++requestId.current
    setLoading(true)

    try {
      const list = await getWishlistProductIds()
      if (current !== requestId.current) return
      setIds(new Set(list))
    } catch (error) {
      // The wishlist is secondary to every page it appears on. A failed read leaves the
      // hearts empty rather than breaking the product grid around them.
      //
      // Silent for the shopper, but NOT silent for a developer: a 404 here means the
      // endpoint is not deployed, and without this line the only symptom is hearts that
      // never fill — which looks like a frontend bug and is not one.
      if (isWishlistUnavailable(error)) {
        console.warn(
          '[panchvastra] GET /v1/wishlist/?ids_only=true returned 404 — the wishlist endpoint is not available on this backend. Hearts will stay empty.',
        )
      }
      if (current === requestId.current) setIds(new Set<number>())
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  const markPending = useCallback((productId: number, busy: boolean) => {
    setPending((previous) => {
      const next = new Set(previous)
      if (busy) next.add(productId)
      else next.delete(productId)
      return next
    })
  }, [])

  /** Applies the change locally first, then confirms it; rolls back on failure. */
  const mutate = useCallback(
    async (productId: number, nextWishlisted: boolean): Promise<WishlistToggleResult> => {
      if (inFlight.current.has(productId)) {
        return { ok: true, wishlisted: nextWishlisted }
      }

      inFlight.current.add(productId)
      markPending(productId, true)

      setIds((previous) => {
        const next = new Set(previous)
        if (nextWishlisted) next.add(productId)
        else next.delete(productId)
        return next
      })

      try {
        if (nextWishlisted) await addToWishlist(productId)
        else await removeFromWishlist(productId)

        return { ok: true, wishlisted: nextWishlisted }
      } catch (error) {
        // Roll back to exactly the opposite of what was optimistically applied.
        setIds((previous) => {
          const next = new Set(previous)
          if (nextWishlisted) next.delete(productId)
          else next.add(productId)
          return next
        })

        return {
          ok: false,
          reason: 'error',
          message: readWishlistApiError(
            error,
            nextWishlisted ? 'Could not save to your wishlist.' : 'Could not remove from your wishlist.',
          ),
        }
      } finally {
        inFlight.current.delete(productId)
        markPending(productId, false)
      }
    },
    [markPending],
  )

  /**
   * Replays a heart tapped while signed out.
   *
   * Runs after the ids for the new session have loaded, so the add lands on top of the
   * real list rather than racing it. The intent is cleared whether or not the add
   * succeeded — a failed replay must not retry forever on every page load.
   */
  useEffect(() => {
    if (!isAuthenticated || loading) return

    const pendingId = readPendingProductId()
    if (pendingId == null) return

    writePendingProductId(null)
    if (ids.has(pendingId)) return

    void mutate(pendingId, true)
  }, [isAuthenticated, loading, ids, mutate])

  const isWishlisted = useCallback(
    (productId: string | number) => {
      const id = toProductId(productId)
      return id != null && ids.has(id)
    },
    [ids],
  )

  const isPending = useCallback(
    (productId: string | number) => {
      const id = toProductId(productId)
      return id != null && pending.has(id)
    },
    [pending],
  )

  const toggle = useCallback(
    async (productId: string | number): Promise<WishlistToggleResult> => {
      const id = toProductId(productId)
      if (id == null) return { ok: false, reason: 'error', message: 'This product cannot be saved.' }

      if (!isAuthenticated) {
        // Remembered so the product is saved automatically once they are back.
        writePendingProductId(id)
        return { ok: false, reason: 'auth' }
      }

      return mutate(id, !ids.has(id))
    },
    [ids, isAuthenticated, mutate],
  )

  const remove = useCallback(
    async (productId: string | number): Promise<WishlistToggleResult> => {
      const id = toProductId(productId)
      if (id == null) return { ok: false, reason: 'error', message: 'This product cannot be removed.' }
      if (!isAuthenticated) return { ok: false, reason: 'auth' }

      return mutate(id, false)
    },
    [isAuthenticated, mutate],
  )

  const value = useMemo<WishlistCtx>(
    () => ({
      ids,
      count: ids.size,
      loading,
      isWishlisted,
      isPending,
      toggle,
      remove,
      refresh: load,
    }),
    [ids, loading, isWishlisted, isPending, toggle, remove, load],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWishlist() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useWishlist requires WishlistProvider')
  return ctx
}
