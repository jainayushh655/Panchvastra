import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { formatInr } from '@/lib/format'
import type { Product } from '@/types'

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

export function ProductCard({ product, variant = 'shop' }: ProductCardProps) {
  const off = discountPercent(product)
  const hoverSrc = product.hoverImage?.trim()
  const mainSrc = product.images[0]

  if (variant === 'homepage') {
    return (
      <motion.article layout whileHover={{ y: -4 }} className="group">
        <Link
          to={`/product/${product.id}`}
          className="block border border-zinc-200 bg-white transition-colors hover:border-zinc-400"
        >
          <div className="relative aspect-[4/5] overflow-hidden bg-[#f5f5f3]">
            <img
              src={mainSrc}
              alt={product.name}
              loading="lazy"
              className={`h-full w-full object-cover grayscale contrast-[1.02] transition-all duration-300 ${
                hoverSrc ? 'group-hover:opacity-0' : 'group-hover:scale-[1.03]'
              }`}
            />
            {hoverSrc ? (
              <img
                src={hoverSrc}
                alt=""
                aria-hidden
                loading="lazy"
                className="pointer-events-none absolute inset-0 h-full w-full object-cover grayscale contrast-[1.02] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
            ) : null}
            {off != null && off > 0 ? (
              <span className="absolute left-2 top-2 border border-black bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
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
      </motion.article>
    )
  }

  return (
    <motion.article layout whileHover={{ y: -6 }} className="group">
      <Link
        to={`/product/${product.id}`}
        className="relative block overflow-hidden rounded-[1.5rem] border border-zinc-200/80 bg-white shadow-[0_18px_50px_-34px_rgba(0,0,0,0.55)] transition-all duration-300 hover:border-zinc-300 hover:shadow-[0_24px_60px_-34px_rgba(0,0,0,0.65)] dark:border-zinc-800 dark:bg-zinc-900/80"
      >
        <div className="relative aspect-[5/4] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          <img
            src={mainSrc}
            alt={product.name}
            loading="lazy"
            className={`h-full w-full object-cover ${
              hoverSrc
                ? 'transition-opacity duration-300 group-hover:opacity-0'
                : 'transition-transform duration-500 group-hover:scale-[1.05]'
            }`}
          />
          {hoverSrc ? (
            <img
              src={hoverSrc}
              alt=""
              aria-hidden
              loading="lazy"
              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            />
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/50 to-transparent" aria-hidden />
          {off != null && off > 0 ? (
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-900 shadow-sm backdrop-blur-sm">
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
    </motion.article>
  )
}
