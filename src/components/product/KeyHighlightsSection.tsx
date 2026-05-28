import { useMemo } from 'react'
import { KeyHighlightItem } from '@/components/product/KeyHighlightItem'
import { resolveProductHighlights } from '@/lib/productHighlights'
import type { Product } from '@/types'

type KeyHighlightsSectionProps = {
  product: Product
  className?: string
}

export function KeyHighlightsSection({ product, className = '' }: KeyHighlightsSectionProps) {
  const highlights = useMemo(() => resolveProductHighlights(product), [product])

  if (!highlights.length) return null

  return (
    <section
      className={`mt-8 border-t border-zinc-200 pt-8 dark:border-zinc-800 ${className}`}
      aria-labelledby="key-highlights-heading"
    >
      <h2
        id="key-highlights-heading"
        className="font-display text-sm font-bold uppercase tracking-[0.12em] text-zinc-900 dark:text-white"
      >
        Key Highlights
      </h2>
      <ul className="mt-1 grid grid-cols-2 gap-x-6 sm:gap-x-10">
        {highlights.map((item) => (
          <li key={item.key} className="min-w-0">
            <KeyHighlightItem {...item} />
          </li>
        ))}
      </ul>
    </section>
  )
}
