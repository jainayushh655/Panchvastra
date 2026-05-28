import { KEYS, readJson, writeJson } from '@/lib/storage'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

type WCtx = {
  ids: string[]
  toggle: (productId: string) => void
  clear: () => void
  has: (productId: string) => boolean
}

const Ctx = createContext<WCtx | null>(null)

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<string[]>(() => readJson(KEYS.wishlist, []))

  useEffect(() => {
    writeJson(KEYS.wishlist, ids)
  }, [ids])

  const toggle = useCallback((productId: string) => {
    setIds((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId],
    )
  }, [])

  const clear = useCallback(() => setIds([]), [])

  const has = useCallback(
    (productId: string) => ids.includes(productId),
    [ids],
  )

  const value = useMemo(
    () => ({ ids, toggle, clear, has }),
    [ids, toggle, clear, has],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useWishlist() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useWishlist requires WishlistProvider')
  return v
}
