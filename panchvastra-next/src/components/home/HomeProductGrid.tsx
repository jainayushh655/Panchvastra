'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ProductCard } from '@/components/ProductCard'
import type { Product } from '@/types'

/**
 * The category-filtered product grid, with VIEW ALL and the Custom Studio block beneath.
 *
 * Ported from the Vite component. The DOM, the classes and the two conditional branches
 * (empty state with its SHOP ALL button; VIEW ALL only when there are products) are
 * unchanged. Two differences:
 *
 * 1. NO `loading` PROP. The products are server-rendered, so there is no skeleton phase
 *    on first paint. Switching a category pill swaps an already-loaded, already-filtered
 *    list, which is instant and needs no loading state — the Vite version did not show
 *    one for that either.
 *
 * 2. THE CUSTOM STUDIO BLOCK ARRIVES AS A PROP. In the Vite file the heading and
 *    `CustomPieceBanner` are rendered inline here. This component has to be a Client
 *    Component (its parent owns the filter state), and the banner is a static, optimised
 *    `next/image` with no interactivity — so it is passed in as already-rendered server
 *    output instead. The DOM position is identical; what changes is that the banner's code
 *    never reaches the browser bundle.
 */
export function HomeProductGrid({
  products,
  customStudio,
}: {
  products: Product[]
  customStudio?: ReactNode
}) {
  return (
    <section className="bg-white px-4 pb-8 sm:pb-10">
      <div className="mx-auto max-w-6xl">
        <div className="grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {products.length === 0 ? (
            <div className="col-span-full py-14 text-center">
              <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">No products available</p>
              <Link
                href="/shop"
                className="mt-5 inline-flex items-center justify-center bg-chocolate px-6 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-espresso"
              >
                Shop All
              </Link>
            </div>
          ) : (
            products.map((p) => <ProductCard key={p.id} product={p} variant="homepage" />)
          )}
        </div>

        {products.length > 0 ? (
          <div className="mt-12 flex justify-center">
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 bg-chocolate px-8 py-3 text-xs font-bold uppercase tracking-[0.16em] text-cream transition-colors hover:bg-espresso"
            >
              View All
              <span aria-hidden>→</span>
            </Link>
          </div>
        ) : null}

        {/* Directly below VIEW ALL and inside the same `max-w-6xl` container, so it is full
            width within the page's content column. Rendered unconditionally — the VIEW ALL
            button only appears when there are products to view, and the Custom Piece offer
            still stands when the catalogue is empty.

            The heading reuses the exact treatment of "Shop By Category" in
            `HomeCategoryGrid`, so the two homepage section titles read as a pair. */}
        <div className="mt-14 text-center">
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-black sm:text-4xl">
            The Custom Studio
          </h2>
        </div>

        {customStudio}
      </div>
    </section>
  )
}
