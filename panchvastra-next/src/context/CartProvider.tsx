'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getCart } from '@/services/cart'
import { useAuth } from '@/context/AuthProvider'
import type { CartItemDto } from '@/types/api/CartDto'
import type { CartItem } from '@/types'

/**
 * The cart.
 *
 * Ported from the Vite application's `src/context/CartProvider.tsx` with no behavioural
 * change. It is worth saying why this one needed no hydration work: the cart lives on the
 * SERVER, not in `localStorage`. The provider starts with an empty list — which is
 * exactly what the server renders — and fills it from `GET /v1/cart_management/` once
 * there is a token. So the server HTML, the first client render and the badge all agree
 * on an empty cart, and the real count arrives on the next paint.
 *
 * It re-reads whenever `token` changes, which now includes the transition from `null` to
 * the restored session that `AuthProvider` performs after mount. No signed-in visitor
 * loses their cart to that: the effect simply runs again with the token in hand.
 *
 * The backend summary stays authoritative for discount/MRP, with item-derived totals used
 * only as a fallback — unchanged from the Vite implementation.
 */

type CartCtx = {
  items: CartItem[]
  clear: () => void
  refreshCart: () => Promise<void>
  subtotal: number
  totalItems: number
  /** Real discount already applied by the backend (cart.summary.total_discount), not a UI calculation. */
  totalDiscount: number
  /** Real pre-discount total (cart.summary.total_mrp), for reference/display alongside totalDiscount. */
  totalMrp: number
  /**
   * True while a signed-in shopper's cart has not been read yet. False for a signed-out
   * visitor, who has no server cart to wait for.
   *
   * ADDITIVE to the Phase 3 contract: the navbar badge ignores it and is unchanged. It
   * exists so the cart PAGE can tell "not loaded yet" apart from "empty", which the Vite
   * provider cannot express.
   */
  isLoading: boolean
  /** Set when the cart read failed, so the page shows an error instead of an empty cart. */
  loadError: string | null
}

const Ctx = createContext<CartCtx | null>(null)

function mapCartItem(item: CartItemDto): CartItem {
  return {
    key: item.cart_item_id.toString(),
    cartItemId: item.cart_item_id,
    productId: item.product_id.toString(),
    slug: item.product_id.toString(),
    name: item.product_name,
    image: item.primary_image,
    price: item.selling_price,
    mrp: item.mrp,
    quantity: item.quantity,
    size: item.size,
    color: item.color,
    availableStock: item.available_stock,
    isInStock: item.is_in_stock,
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [summary, setSummary] = useState<{ totalDiscount: number; totalMrp: number }>({
    totalDiscount: 0,
    totalMrp: 0,
  })
  const { token } = useAuth()

  /**
   * The token whose cart is currently in `items`, and the reason this is state rather
   * than a boolean flag.
   *
   * `isLoading` has to be true from the FIRST render in which a token exists but its cart
   * has not been read yet — not from whenever an effect happens to run. A plain
   * `setIsLoading(true)` inside the load effect is one render too late: in that gap the
   * cart page would see `items: []` with `isLoading: false` and paint "Your cart is
   * empty" at a signed-in shopper, for one frame, on every single visit.
   *
   * Comparing the loaded token against the live one closes that gap by construction —
   * the moment `AuthProvider` restores a session, this already disagrees, so `isLoading`
   * is true in the same commit. It is the same technique `WishlistProvider` uses to key
   * its items by account, and for the same class of reason.
   */
  const [loadedToken, setLoadedToken] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadCart = useCallback(async () => {
    if (!token) {
      setItems([])
      setSummary({ totalDiscount: 0, totalMrp: 0 })
      setLoadError(null)
      setLoadedToken(null)
      return
    }

    try {
      const cart = await getCart()
      setItems(cart.items.map(mapCartItem))
      setSummary({
        totalDiscount: cart.summary?.total_discount ?? 0,
        totalMrp: cart.summary?.total_mrp ?? 0,
      })
      setLoadError(null)
    } catch (error) {
      console.error(error)
      setItems([])
      setSummary({ totalDiscount: 0, totalMrp: 0 })
      /*
       * A FAILED READ IS NOT AN EMPTY CART.
       *
       * The Vite provider logs and leaves the list empty, so a 500 or a dropped
       * connection renders "Your cart is empty" — telling a shopper their cart was
       * emptied when the truth is it could not be read. The items are still cleared
       * (showing a stale cart would be worse), but the reason is recorded so the page can
       * say what actually happened and offer a retry.
       *
       * The message is deliberately generic: this backend's 5xx bodies can carry raw
       * exception text.
       */
      setLoadError('We could not load your cart. Please try again.')
    } finally {
      // Marks THIS token as read, whether it succeeded or failed — a failed read must end
      // the loading state, or the page would spin forever instead of showing the error.
      setLoadedToken(token)
    }
  }, [token])

  const clear = useCallback(() => {
    setItems([])
    setSummary({ totalDiscount: 0, totalMrp: 0 })
    setLoadError(null)
  }, [])

  useEffect(() => {
    void loadCart()
  }, [loadCart])

  const { subtotal, totalItems, itemsMrpTotal } = useMemo(() => {
    let subtotal = 0
    let totalItems = 0
    // SUM(mrp × quantity), used only as a fallback when the backend sends no summary.
    let itemsMrpTotal = 0
    items.forEach((item) => {
      subtotal += item.price * item.quantity
      totalItems += item.quantity
      itemsMrpTotal += (item.mrp ?? item.price) * item.quantity
    })
    return { subtotal, totalItems, itemsMrpTotal }
  }, [items])

  const value = useMemo(
    () => ({
      items,
      clear,
      refreshCart: loadCart,
      subtotal,
      totalItems,
      // The backend summary stays authoritative; the item-derived totals only fill in when
      // it sends none, so the UI never shows ₹0 against a non-zero subtotal.
      totalDiscount: summary.totalDiscount || Math.max(0, itemsMrpTotal - subtotal),
      totalMrp: summary.totalMrp || itemsMrpTotal,
      // A signed-in shopper whose token has not been read yet. See `loadedToken` above for
      // why this is a comparison and not a flag set inside the effect.
      isLoading: token !== null && loadedToken !== token,
      loadError,
    }),
    [clear, items, loadCart, subtotal, totalItems, summary, itemsMrpTotal, token, loadedToken, loadError],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const value = useContext(Ctx)
  if (!value) throw new Error('useCart requires CartProvider')
  return value
}
