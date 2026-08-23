import { Link } from 'react-router-dom'
import { formatInr } from '@/lib/format'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useWishlist } from '@/context/WishlistProvider'

export function WishlistPage() {
  useDocumentTitle('Wishlist')
  const { items, remove } = useWishlist()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="type-page-title">Wishlist</h1>

      {items.length === 0 ? (
        <p className="mt-8 text-zinc-600 dark:text-zinc-400">
          Nothing saved yet.{' '}
          <Link to="/shop" className="font-semibold text-black underline underline-offset-2 dark:text-white">
            Browse products →
          </Link>
        </p>
      ) : (
        <ul className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <li key={item.id} className="group relative border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label={`Remove ${item.name} from wishlist`}
                className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-black transition-colors hover:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              >
                ✕
              </button>
              <Link to={`/product/${item.id}`} className="block">
                <div className="aspect-[4/5] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  <img src={item.image} alt={item.name} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="p-3">
                  <h3 className="line-clamp-1 text-sm font-semibold text-zinc-900 dark:text-white">{item.name}</h3>
                  <div className="mt-1.5 flex items-baseline gap-2">
                    <span className="text-sm font-bold text-black dark:text-white">{formatInr(item.price)}</span>
                    {item.compareAtPrice != null && item.compareAtPrice > item.price ? (
                      <span className="text-xs text-zinc-400 line-through">{formatInr(item.compareAtPrice)}</span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
