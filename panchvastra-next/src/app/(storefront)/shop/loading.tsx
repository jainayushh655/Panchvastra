import { ProductGridSkeleton } from '@/components/shop/ProductGridSkeleton'

/**
 * The Shop page's loading boundary — a Server Component, shown while the server fetches
 * the catalogue for a new query.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS PER-ROUTE NOW, AND NOT AT THE ROOT
 * ──────────────────────────────────────────────────────────────────────────────
 * Phase 2 shipped one generic `app/loading.tsx` and recorded that per-route files
 * mirroring each page's real layout were the goal. This is that, and there is a second
 * reason it had to happen here rather than later.
 *
 * A `loading.tsx` wraps every route BELOW it in a Suspense boundary, which makes Next
 * start streaming the response immediately — so the HTTP status is committed as 200
 * before the page's own code runs. With the generic file at the root, a product id that
 * does not exist rendered the not-found page with a `200 OK`, which tells a crawler the
 * URL is fine and is exactly the signal a dead product link must not send. Measured, not
 * assumed: `/product/9999` answered 200 with the file in place and 404 without it.
 *
 * Scoping the boundary to Shop keeps the feedback where a wait is actually likely — Shop
 * is dynamically rendered per filter combination — while `/product/[id]` can return a
 * real 404. Product pages are prefetched by `next/link` from the grid above them, so the
 * navigation they lose a skeleton for is usually already resolved.
 *
 * The skeleton mirrors the real page: the heading block, the toolbar row and the product
 * grid land in the same places, so nothing jumps when the content replaces it.
 */
export default function ShopLoading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8" role="status" aria-busy="true">
      <span className="sr-only">Loading products</span>

      {/* Stands in for the `type-page-title` heading. */}
      <div className="h-9 w-56 rounded-sm bg-zinc-200" aria-hidden />

      {/* The filter row: four selects and the reset button, at their real sizes. */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4" aria-hidden>
        <div className="flex flex-wrap items-center gap-2.5">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="h-[38px] w-[9.5rem] rounded-sm bg-zinc-200" />
          ))}
          <div className="h-[38px] w-28 rounded-sm bg-zinc-200" />
        </div>
        <div className="h-[38px] w-[9.5rem] rounded-sm bg-zinc-200" />
      </div>

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <ProductGridSkeleton count={8} />
      </div>
    </div>
  )
}
