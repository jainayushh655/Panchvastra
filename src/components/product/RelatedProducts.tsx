import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRelatedProducts } from '@/api/product'
import { WishlistHeartButton } from '@/components/wishlist/WishlistHeartButton'
import { formatInr } from '@/lib/format'
import { mapProduct } from '@/mappers/productMapper'
import type { Product } from '@/types'

/**
 * "You May Also Like".
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * LAZY, AND WHY
 * ──────────────────────────────────────────────────────────────────────────────
 * The request is not made until the rail is about to come into view. It sits below the
 * reviews, which are themselves below the fold, so firing it on mount would mean eight
 * extra product records competing for bandwidth with the hero image the shopper is
 * actually looking at. An `IntersectionObserver` with a 300px margin starts the fetch just
 * before the rail is reached, so the cards are usually there by the time it arrives.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * NO LAYOUT SHIFT
 * ──────────────────────────────────────────────────────────────────────────────
 * The section holds its height with skeleton cards from the moment it is observed, so the
 * footer does not jump upward when the real cards land. Once loaded, an EMPTY result
 * removes the section entirely — a rail with nothing in it is worse than no rail — and
 * that single collapse happens below everything the shopper is reading.
 */

const SKELETON_COUNT = 4

function RelatedSkeleton() {
  return (
    <li className="w-[200px] shrink-0 sm:w-auto" aria-hidden>
      <div className="aspect-[4/3] w-full rounded-xl bg-soft-beige" />
      <div className="mt-3 h-3 w-3/4 rounded-sm bg-soft-beige" />
      <div className="mt-2 h-3 w-1/3 rounded-sm bg-soft-beige" />
    </li>
  )
}

/**
 * A card for this rail specifically.
 *
 * Deliberately NOT the shared `ProductCard`. That component draws a bordered, shadowed
 * panel, which is right for a grid of results on the Shop page but wrong here: at the foot
 * of a product page the rail is a quiet suggestion, and the reference shows a bare
 * rounded image with the name and price beneath it on the page background. Widening
 * `ProductCard` with a third visual variant would push that decision into a component
 * three other pages depend on.
 *
 * The heart sits OUTSIDE the `<Link>` — nesting a button inside an anchor is invalid HTML
 * and makes the card unusable with a keyboard.
 */
function RelatedCard({ product }: { product: Product }) {
  return (
    <div className="group relative">
      <WishlistHeartButton productId={product.id} className="absolute right-2.5 top-2.5 z-10" />

      <Link to={`/product/${product.id}`} className="block">
        <div className="overflow-hidden rounded-xl bg-soft-beige">
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>

        <p className="mt-3 line-clamp-1 font-sans text-sm font-semibold text-black">{product.name}</p>

        <p className="mt-0.5 flex flex-wrap items-baseline gap-2">
          <span className="font-sans text-sm font-bold text-black">{formatInr(product.price)}</span>
          {product.compareAtPrice != null && product.compareAtPrice > product.price ? (
            <span className="font-sans text-xs text-zinc-400 line-through">
              {formatInr(product.compareAtPrice)}
            </span>
          ) : null}
        </p>
      </Link>
    </div>
  )
}

export function RelatedProducts({ productId }: { productId: number | string }) {
  const sectionRef = useRef<HTMLElement | null>(null)
  const railRef = useRef<HTMLUListElement | null>(null)

  const [visible, setVisible] = useState(false)
  const [products, setProducts] = useState<Product[] | null>(null)

  // Observe once, then disconnect — this never needs to fire twice.
  useEffect(() => {
    const node = sectionRef.current
    if (!node) return

    // No observer (very old browser, or a test environment): load immediately rather than
    // leaving the rail permanently empty.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!visible) return

    let active = true
    // Reset on a product change so the previous product's rail is never shown under a new
    // heading while the new one loads.
    setProducts(null)

    // `getRelatedProducts` swallows its own failures into an empty list: this is a
    // secondary rail and must never be able to break the product above it.
    getRelatedProducts(productId).then((dtos) => {
      if (active) setProducts(dtos.map(mapProduct))
    })

    return () => {
      active = false
    }
  }, [visible, productId])

  const scrollBy = (direction: 1 | -1) => {
    const rail = railRef.current
    if (!rail) return
    rail.scrollBy({ left: direction * Math.max(220, rail.clientWidth * 0.8), behavior: 'smooth' })
  }

  // Loaded and genuinely empty — a category with only this product in it.
  if (products !== null && products.length === 0) return null

  const loading = products === null

  return (
    <section ref={sectionRef} aria-labelledby="related-heading" className="mt-12 sm:mt-16">
      <div className="flex items-center justify-between gap-4">
        <h2 id="related-heading" className="font-display text-xl font-bold tracking-tight text-black sm:text-2xl">
          You May Also Like
        </h2>

        <Link
          to="/shop"
          className="font-sans text-xs font-semibold uppercase tracking-wide text-zinc-600 underline-offset-4 transition-colors hover:text-black hover:underline"
        >
          View All →
        </Link>
      </div>

      <div className="relative mt-5">
        {/*
          A horizontal scroller on a phone and a four-up grid from `lg`. Scroll-snap and
          native overflow rather than a carousel library — the project has no slider
          dependency and does not need one for a row of cards.
        */}
        {/*
          A scroller at EVERY width, not a grid at `lg`. The design shows arrows beside a
          four-up row on desktop, and arrows only mean something if there is something to
          scroll — a grid would leave them inert, or force hiding them at exactly the width
          the design shows them.

          Four cards fill the row at `lg` (`calc` accounts for the three 1rem gaps), so a
          result of four or fewer looks like a static row and a longer one scrolls.
        */}
        <ul
          ref={railRef}
          className="pv-hide-scrollbar flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-1"
        >
          {loading
            ? Array.from({ length: SKELETON_COUNT }, (_, index) => <RelatedSkeleton key={index} />)
            : products.map((product) => (
                <li
                  key={product.id}
                  className="w-[200px] shrink-0 snap-start sm:w-[240px] lg:w-[calc((100%-3rem)/4)]"
                >
                  <RelatedCard product={product} />
                </li>
              ))}
        </ul>

        {/* Arrows only where the rail actually scrolls. From `lg` it is a grid. */}
        {!loading && products.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => scrollBy(-1)}
              aria-label="Scroll to previous products"
              className="absolute -left-3 top-[34%] hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-sand bg-cream text-espresso shadow-sm transition-colors hover:bg-soft-beige sm:flex"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path d="M15 5l-7 7 7 7" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <button
              type="button"
              onClick={() => scrollBy(1)}
              aria-label="Scroll to more products"
              className="absolute -right-3 top-[34%] hidden size-9 -translate-y-1/2 items-center justify-center rounded-full border border-sand bg-cream text-espresso shadow-sm transition-colors hover:bg-soft-beige sm:flex"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path d="M9 5l7 7-7 7" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        ) : null}
      </div>
    </section>
  )
}
