import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { ProductCard } from '@/components/ProductCard'
import { useWishlist } from '@/context/WishlistProvider'
import { getProductsSnapshot } from '@/lib/catalogStore'
import { useCatalog } from '@/hooks/useCatalog'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function WishlistPage() {
  useDocumentTitle('Wishlist')
  const { ids } = useWishlist()
  const { revision } = useCatalog()

  const items = useMemo(() => {
    const catalog = getProductsSnapshot()
    return catalog.filter((p) => ids.includes(p.id))
  }, [ids, revision])

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="type-page-title">
        Wishlist
      </h1>
      {items.length === 0 ? (
        <p className="mt-8 text-zinc-600 dark:text-zinc-400">
          Save pieces from product pages.{' '}
          <Link to="/shop" className="font-semibold text-orange-600 dark:text-orange-400">
            Browse shop
          </Link>
        </p>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}
