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
  const { token } = useAuth()

  const loadCart = useCallback(async () => {
    if (!token) {
      setItems([])
      return
    }

    try {
      const cart = await getCart()
      setItems(cart.items.map(mapCartItem))
    } catch (error) {
      console.error(error)
      setItems([])
    }
  }, [token])

  const clear = useCallback(() => {
    setItems([])
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
    }),
    [clear, items, loadCart, subtotal, totalItems],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const value = useContext(Ctx)
  if (!value) throw new Error('useCart requires CartProvider')
  return value
}
