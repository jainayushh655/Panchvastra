import type {
  CartItemDto,
  CartQuantityTierDto,
  NextCartQuantityTierDto,
} from '@/types/api/CartDto'
import { getCart } from '@/api/cart'
import { useAuth } from '@/context/AuthProvider'
import type { CartItem } from '@/types'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

/**
 * The cart, read from `/v1/cart_management/`.
 *
 * ⚠️ THE BACKEND OWNS EVERY MONEY FIGURE. The quantity offer in particular is computed
 * against the whole cart — the tier applies to the TOTAL number of items across different
 * products — so nothing here recomputes it. After any quantity change or removal the cart
 * is re-read and whatever comes back is displayed. Deriving a tier on the client would be
 * wrong the moment the admin adds a tier, and would disagree with the amount actually
 * charged at checkout.
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

  /* ----------------------------------------------------------- quantity offer */

  /** Rupees off from the quantity offer. 0 when no tier is earned. */
  quantityDiscount: number
  /** The tier currently earned, or null. */
  appliedQuantityTier: CartQuantityTierDto | null
  /** The next tier up and how many more items it needs, or null at the top of the ladder. */
  nextQuantityTier: NextCartQuantityTierDto | null
  /**
   * `subtotal − quantityDiscount`, before any coupon — the figure to show as the total.
   *
   * Falls back to the computed difference only when the backend sends no `amount_payable`
   * (an older deployment), so the cart never shows a total that contradicts its own lines.
   */
  amountPayable: number
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

type CartSummaryState = {
  totalDiscount: number
  totalMrp: number
  quantityDiscount: number
  appliedQuantityTier: CartQuantityTierDto | null
  nextQuantityTier: NextCartQuantityTierDto | null
  /** null when the backend sent none, so the fallback below can tell "0" from "absent". */
  amountPayable: number | null
}

const EMPTY_SUMMARY: CartSummaryState = {
  totalDiscount: 0,
  totalMrp: 0,
  quantityDiscount: 0,
  appliedQuantityTier: null,
  nextQuantityTier: null,
  amountPayable: null,
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [summary, setSummary] = useState<CartSummaryState>(EMPTY_SUMMARY)
  const { token } = useAuth()

  const loadCart = useCallback(async () => {
    if (!token) {
      setItems([])
      setSummary(EMPTY_SUMMARY)
      return
    }

    try {
      const cart = await getCart()
      setItems(cart.items.map(mapCartItem))
      setSummary({
        totalDiscount: cart.summary?.total_discount ?? 0,
        totalMrp: cart.summary?.total_mrp ?? 0,
        quantityDiscount: cart.summary?.quantity_discount_amount ?? 0,
        appliedQuantityTier: cart.summary?.applied_quantity_tier ?? null,
        nextQuantityTier: cart.summary?.next_quantity_tier ?? null,
        amountPayable: cart.summary?.amount_payable ?? null,
      })
    } catch (error) {
      console.error(error)
      setItems([])
      setSummary(EMPTY_SUMMARY)
    }
  }, [token])

  const clear = useCallback(() => {
    setItems([])
    setSummary(EMPTY_SUMMARY)
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

      quantityDiscount: summary.quantityDiscount,
      appliedQuantityTier: summary.appliedQuantityTier,
      nextQuantityTier: summary.nextQuantityTier,
      // Only computed when the field is genuinely absent — never to "correct" the server.
      amountPayable: summary.amountPayable ?? Math.max(0, subtotal - summary.quantityDiscount),
    }),
    [clear, items, loadCart, subtotal, totalItems, summary, itemsMrpTotal],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const value = useContext(Ctx)
  if (!value) throw new Error('useCart requires CartProvider')
  return value
}
