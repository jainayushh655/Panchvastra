import { productToCartItem } from '@/lib/api'
import { KEYS, readJson, writeJson } from '@/lib/storage'
import type { CartItem, Product } from '@/types'
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
  addItem: (product: Product, size: string, quantity?: number, color?: string) => void
  removeItem: (key: string) => void
  setQty: (key: string, quantity: number) => void
  clear: () => void
  subtotal: number
  totalItems: number
}

const Ctx = createContext<CartCtx | null>(null)

function mergeItems(prev: CartItem[], next: CartItem): CartItem[] {
  const idx = prev.findIndex((x) => x.key === next.key)
  if (idx === -1) return [...prev, next]
  const copy = [...prev]
  copy[idx] = {
    ...copy[idx],
    quantity: Math.min(99, copy[idx].quantity + next.quantity),
  }
  return copy
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => readJson(KEYS.cart, []))

  useEffect(() => {
    writeJson(KEYS.cart, items)
  }, [items])

  const addItem = useCallback((product: Product, size: string, quantity = 1, color?: string) => {
    const next = productToCartItem(product, size, quantity, color)
    setItems((prev) => mergeItems(prev, next))
  }, [])

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key))
  }, [])

  const setQty = useCallback((key: string, quantity: number) => {
    if (quantity < 1) {
      removeItem(key)
      return
    }
    setItems((prev) =>
      prev.map((i) =>
        i.key === key ? { ...i, quantity: Math.min(99, quantity) } : i,
      ),
    )
  }, [removeItem])

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
      addItem,
      removeItem,
      setQty,
      clear,
      subtotal,
      totalItems,
    }),
    [items, addItem, removeItem, setQty, clear, subtotal, totalItems],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useCart requires CartProvider')
  return v
}
