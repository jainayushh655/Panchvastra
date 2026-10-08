import { Link } from 'react-router-dom'
import { ProductCard } from '@/components/ProductCard'
import { CustomPieceBanner } from '@/components/home/CustomPieceBanner'
import { ProductGridSkeleton } from '@/components/shop/ProductGridSkeleton'
import type { Product } from '@/types'

export function HomeProductGrid({ products, loading }: { products: Product[]; loading: boolean }) {
  return (
    <section className="bg-white px-4 pb-8 sm:pb-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {loading ? (
            <ProductGridSkeleton count={8} />
          ) : products.length === 0 ? (
            <div className="col-span-full py-14 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">No products available</p>
              <Link
                to="/shop"
                className="mt-5 inline-flex items-center justify-center bg-black px-6 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-800"
              >
                Shop All
              </Link>
            </div>
          ) : (
            products.map((p) => <ProductCard key={p.id} product={p} variant="homepage" />)
          )}
        </div>

        {!loading && products.length > 0 ? (
          <div className="mt-12 flex justify-center">
            <Link
              to="/shop"
              className="inline-flex items-center gap-2 bg-black px-8 py-3 text-xs font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-zinc-800"
            >
              View All
              <span aria-hidden>→</span>
            </Link>
          </div>
        ) : null}

        {/* Directly below VIEW ALL and inside the same `max-w-6xl` container, so it is full
            width within the page's content column. Rendered unconditionally — the VIEW ALL
            button only appears when there are products to view, and the Custom Piece offer
            still stands when the catalogue is empty or still loading. */}
        <CustomPieceBanner />
      </div>
    </section>
  )
}
