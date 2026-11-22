import Link from 'next/link'
import { BackendImage } from '@/components/BackendImage'
import { formatInr } from '@/lib/format'
import type { Product } from '@/types'

/**
 * A catalogue product card.
 *
 * Ported from the Vite `ProductCard`, both variants, class for class. Two changes:
 *
 * 1. NO FRAMER-MOTION. The Vite card is a `motion.article` with `layout` and
 *    `whileHover={{ y: -4 }}` (homepage) / `{ y: -6 }` (shop). The hover lift is now a CSS
 *    transform on the same axis and distance (`-translate-y-1` = 4px, `-translate-y-1.5` =
 *    6px) with a matching transition, so the card behaves the same under the cursor
 *    without shipping an animation runtime for it.
 *
 *    THE ONE THING CSS DOES NOT REPRODUCE, and it needs sign-off: `layout`. When the
 *    homepage's category pill changes, framer-motion animates each surviving card from its
 *    old grid position to its new one. Here the grid simply re-renders in place. Nothing
 *    is lost or mispositioned — the swap is instant instead of gliding — and on a phone,
 *    where the pills matter most, the grid is two columns and most cards are replaced
 *    rather than moved, so there is little to glide.
 *
 * 2. IMAGES ARE `next/image`. `fill` + `object-cover` inside the same fixed-ratio box, so
 *    the rendering is identical and the box still reserves its space before the file
 *    arrives (no layout shift). `loading="lazy"` is kept from the original — every product
 *    card on the homepage is below the hero.
 *
 * This file is a Server Component where it is rendered from one (New Arrivals). Inside the
 * category browser island it is client-rendered, because its parent owns the filter state.
 */

function discountPercent(p: Product): number | null {
  if (p.salePct != null && p.salePct > 0) return p.salePct
  const cmp = p.compareAtPrice
  if (cmp != null && cmp > p.price) return Math.round((1 - p.price / cmp) * 100)
  return null
}

type ProductCardProps = {
  product: Product
  /** 'shop' (default) preserves the existing Shop-page look. 'homepage' applies the monochrome streetwear treatment. */
  variant?: 'shop' | 'homepage'
}

/** The card sits in a fixed-ratio box, so one column-width hint serves every breakpoint. */
const CARD_IMAGE_SIZES = '(min-width: 1024px) 25vw, 50vw'

export function ProductCard({ product, variant = 'shop' }: ProductCardProps) {
  const off = discountPercent(product)
  const hoverSrc = product.hoverImage?.trim()
  const mainSrc = product.images[0]

  if (variant === 'homepage') {
    return (
      <article className="group transition-transform duration-200 ease-out hover:-translate-y-1">
        <Link
          href={`/product/${product.id}`}
          className="block border border-zinc-200 bg-white transition-colors hover:border-zinc-400"
        >
          <div className="relative aspect-[4/5] overflow-hidden bg-soft-beige">
            <BackendImage
              src={mainSrc}
              alt={product.name}
              fill
              sizes={CARD_IMAGE_SIZES}
              loading="lazy"
              className={`object-cover transition-all duration-300 ${
                hoverSrc ? 'group-hover:opacity-0' : 'group-hover:scale-[1.03]'
              }`}
            />
            {hoverSrc ? (
              <BackendImage
                src={hoverSrc}
                alt=""
                aria-hidden
                fill
                sizes={CARD_IMAGE_SIZES}
                loading="lazy"
                className="pointer-events-none object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
            ) : null}
            {off != null && off > 0 ? (
              <span className="absolute left-2 top-2 z-10 border border-burgundy bg-burgundy px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cream">
                {off}% off
              </span>
            ) : null}
          </div>
          <div className="border-t border-zinc-200 p-3">
            <h3 className="line-clamp-1 text-xs font-semibold uppercase tracking-wide text-black">{product.name}</h3>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-sm font-bold text-black">{formatInr(product.price)}</span>
              {product.compareAtPrice != null && product.compareAtPrice > product.price ? (
                <span className="text-xs text-zinc-400 line-through">{formatInr(product.compareAtPrice)}</span>
              ) : null}
            </div>
          </div>
        </Link>
      </article>
    )
  }

  return (
    <article className="group transition-transform duration-300 ease-out hover:-translate-y-1.5">
      <Link
        href={`/product/${product.id}`}
        className="relative block overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-white shadow-[0_18px_50px_-34px_rgba(0,0,0,0.55)] transition-all duration-300 hover:border-zinc-300 hover:shadow-[0_24px_60px_-34px_rgba(0,0,0,0.65)] dark:border-zinc-800 dark:bg-zinc-900/80"
      >
        <div className="relative aspect-[5/4] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          <BackendImage
            src={mainSrc}
            alt={product.name}
            fill
            sizes={CARD_IMAGE_SIZES}
            loading="lazy"
            className={`object-cover ${
              hoverSrc
                ? 'transition-opacity duration-300 group-hover:opacity-0'
                : 'transition-transform duration-500 group-hover:scale-[1.05]'
            }`}
          />
          {hoverSrc ? (
            <BackendImage
              src={hoverSrc}
              alt=""
              aria-hidden
              fill
              sizes={CARD_IMAGE_SIZES}
              loading="lazy"
              className="pointer-events-none object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" aria-hidden />
          {off != null && off > 0 ? (
            <span className="absolute left-3 top-3 z-10 rounded-full bg-burgundy/95 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cream shadow-sm backdrop-blur-sm">
              {off}% off
            </span>
          ) : null}
        </div>
        <div className="p-4 sm:p-5">
          <h3 className="type-product-title line-clamp-2">{product.name}</h3>
          <div className="mt-3 h-px w-full bg-gradient-to-r from-zinc-200 via-zinc-300 to-transparent dark:from-zinc-700 dark:via-zinc-600" aria-hidden />
          <div className="mt-3 flex items-end justify-start gap-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="type-price text-lg">{formatInr(product.price)}</span>
              {product.compareAtPrice != null && product.compareAtPrice > product.price ? (
                <span className="text-sm text-zinc-400 line-through">{formatInr(product.compareAtPrice)}</span>
              ) : null}
            </div>
          </div>
        </div>
      </Link>
    </article>
  )
}
