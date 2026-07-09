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
};
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const { isAuthenticated } = useAuth();

  const loadCart = useCallback(async () => {
  if (!isAuthenticated) {
    setItems([]);
    return;
  }

  try {
    const cart = await getCart();
    setItems(cart.items.map(mapCartItem));
  } catch (error) {
    console.error(error);
  }
}, [isAuthenticated]);

useEffect(() => {
  loadCart();
}, [loadCart]);


  const clear = useCallback(() => setItems([]), [])

  const { subtotal, totalItems } = useMemo(() => {
    let subtotal = 0
    let totalItems = 0
    items.forEach((i) => {
      subtotal += i.price * i.quantity
      totalItems += i.quantity
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
    [
  items,
  clear,
  loadCart,
  subtotal,
  totalItems,
],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCart requires CartProvider')
  return v
}
