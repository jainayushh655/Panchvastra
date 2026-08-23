import type { CartItemDto } from "@/types/api/CartDto";
import { getCart } from "@/api/cart";
import { useAuth } from "@/context/AuthProvider";
import type { CartItem } from '@/types'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

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
    quantity: item.quantity,
    size: item.size,
    color: item.color,
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [summary, setSummary] = useState<{ totalDiscount: number; totalMrp: number }>({ totalDiscount: 0, totalMrp: 0 })
  const { token } = useAuth()

  const loadCart = useCallback(async () => {
    if (!token) {
      setItems([])
      setSummary({ totalDiscount: 0, totalMrp: 0 })
      return
    }

    try {
      const cart = await getCart()
      setItems(cart.items.map(mapCartItem))
      setSummary({
        totalDiscount: cart.summary?.total_discount ?? 0,
        totalMrp: cart.summary?.total_mrp ?? 0,
      })
    } catch (error) {
      console.error(error)
      setItems([])
      setSummary({ totalDiscount: 0, totalMrp: 0 })
    }
  }, [token])

  const clear = useCallback(() => {
    setItems([])
    setSummary({ totalDiscount: 0, totalMrp: 0 })
  }, [])

  useEffect(() => {
    void loadCart()
  }, [loadCart])

  const { subtotal, totalItems } = useMemo(() => {
    let subtotal = 0
    let totalItems = 0
    items.forEach((item) => {
      subtotal += item.price * item.quantity
      totalItems += item.quantity
    })
    return { subtotal, totalItems }
  }, [items])

  const value = useMemo(
    () => ({
      items,
      clear,
      refreshCart: loadCart,
      subtotal,
      totalItems,
      totalDiscount: summary.totalDiscount,
      totalMrp: summary.totalMrp,
    }),
    [clear, items, loadCart, subtotal, totalItems, summary],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const value = useContext(Ctx)
  if (!value) throw new Error('useCart requires CartProvider')
  return value
}
