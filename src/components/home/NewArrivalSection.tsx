import { ProductCard } from '@/components/ProductCard'
import { ProductGridSkeleton } from '@/components/shop/ProductGridSkeleton'
import type { Product } from '@/types'

export function NewArrivalSection({ products, loading }: { products: Product[]; loading: boolean }) {
  return (
    <section className="bg-white px-4 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Fresh Drop</p>
          <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-black sm:text-4xl">
            New Arrival
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {loading ? (
            <ProductGridSkeleton count={4} />
          ) : products.length === 0 ? (
            <p className="col-span-full text-center text-sm text-zinc-500">No products available.</p>
          ) : (
            products.map((p) => <ProductCard key={p.id} product={p} variant="homepage" />)
          )}
        </div>
      </div>
    </section>
  )
}
