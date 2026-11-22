import { ProductCard } from '@/components/ProductCard'
import type { Product } from '@/types'

/**
 * The "New Arrival" section.
 *
 * Ported from the Vite component, same markup and classes. A Server Component: the
 * products arrive as a prop from the page's server-side read, so this section is in the
 * server-rendered HTML and ships no JavaScript.
 *
 * THE `loading` PROP IS GONE, and with it the skeleton. In the Vite app the products are
 * fetched in the browser, so the section had to paint `ProductGridSkeleton` first and
 * swap it for real cards — a guaranteed reflow on every first visit. Here the data is
 * already in the HTML, so there is nothing to wait for and nothing to swap: no skeleton,
 * no shift. The EMPTY state is unchanged, down to the copy, because an empty catalogue is
 * still a real state.
 */
export function NewArrivalSection({ products }: { products: Product[] }) {
  return (
    <section className="bg-white px-4 pb-6 pt-8 sm:pb-8 sm:pt-10">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Fresh Drop</p>
          <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-black sm:text-4xl">
            New Arrival
          </h2>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 sm:mt-10 lg:grid-cols-4">
          {products.length === 0 ? (
            <p className="col-span-full text-center text-sm text-zinc-500">No products available.</p>
          ) : (
            products.map((p) => <ProductCard key={p.id} product={p} variant="homepage" />)
          )}
        </div>
      </div>
    </section>
  )
}
