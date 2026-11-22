import { KeyHighlightItem } from '@/components/product/KeyHighlightItem'
import { resolveProductHighlights } from '@/lib/productHighlights'
import type { Product } from '@/types'

/**
 * Key Highlights — the admin's own `{ label, value }` rows for this product.
 *
 * Ported from the Vite component. Two changes, both consequences of it now being a
 * SERVER component: `useMemo` is gone (there is nothing to memoise across renders on the
 * server, and the resolve is a map over a short array), and the rows are in the HTML, so
 * a crawler reads the product's real specifications rather than an empty section.
 *
 * It renders nothing when the admin has saved no highlights — see `productHighlights.ts`
 * for why nothing is invented to fill the gap.
 */
export function KeyHighlightsSection({ product, className = '' }: { product: Product; className?: string }) {
  const highlights = resolveProductHighlights(product)

  if (!highlights.length) return null

  return (
    <section
      className={`mt-8 border-t border-zinc-200 pt-8 dark:border-zinc-800 ${className}`}
      aria-labelledby="key-highlights-heading"
    >
      <h2
        id="key-highlights-heading"
        className="font-sans text-sm font-bold uppercase tracking-[0.12em] text-zinc-900 dark:text-white"
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
