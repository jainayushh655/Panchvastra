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

export function ProductCard({ product }: { product: Product }) {
  const off = discountPercent(product)
  const hoverSrc = product.hoverImage?.trim()
  const mainSrc = product.images[0]

  return (
    <motion.article layout whileHover={{ y: -4 }} className="group">
      <Link
        to={`/product/${product.slug}`}
        className="relative block overflow-hidden rounded-none border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80"
      >
        <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
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
        </div>
        <div className="p-4">
          <h3 className="type-product-title">{product.name}</h3>
          <div
            className="mt-3 border-t border-zinc-300 dark:border-zinc-600"
            aria-hidden
          />
          <div className="mt-3 flex items-end justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="type-price text-lg">
                {formatInr(product.price)}
              </span>
              {product.compareAtPrice != null && product.compareAtPrice > product.price ? (
                <span className="text-sm text-zinc-400 line-through">
                  {formatInr(product.compareAtPrice)}
                </span>
              ) : null}
            </div>
            {off != null && off > 0 ? (
              <span className="shrink-0 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                {off}% off
              </span>
            ) : null}
          </div>
        </div>
      </Link>
    </motion.article>
  )
}
