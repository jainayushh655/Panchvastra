import type { Product, ProductHighlightRef } from '@/types'

/**
 * Key Highlights for the product page.
 *
 * These rows are the admin's data and nothing else. The product page shows exactly the
 * `{ label, value }` pairs saved on that product — in the order they were saved — and
 * shows no section at all when a product has none.
 *
 * This module used to invent most of what the page displayed, which is why products showed
 * highlights nobody had entered. Three separate sources of made-up rows are gone:
 *
 *   1. A fixed block of five "base specs" (Product Category, Product Type, Fit, Closure,
 *      Length) was prepended to EVERY product, with values guessed from the category slug —
 *      "No Closure", "Above Knee", "Relaxed Fit". These were never stored anywhere and
 *      appeared even on products whose highlights the admin had filled in completely.
 *   2. When a product had no stored highlights, keywords were scraped out of its
 *      description, details and tags to guess rows from a hardcoded catalogue — so the word
 *      "premium" anywhere in a description silently produced a "Quality: Premium Quality"
 *      row.
 *   3. A "Returns: 7 Days Exchange Policy" row was appended unconditionally.
 *
 * All of it is removed. The admin form is the single place highlights are authored (see
 * `keyHighlights.ts` for the create-form template, which is an authoring convenience and
 * never merges itself into stored data), and this is the single place they are read.
 */

export type ResolvedProductHighlight = {
  /** Stable, unique render key. Not meaningful data — never displayed. */
  key: string
  specLabel: string
  value: string
}

/**
 * Reads one saved row.
 *
 * `ProductHighlightRef` still permits a bare string for backwards compatibility, but a
 * string carries no label and no value, so there is nothing to display and nothing that
 * could be shown without inventing it — those are skipped rather than guessed at.
 * `productDetailMapper` only ever produces the object form.
 */
function readRow(ref: ProductHighlightRef): { specLabel: string; value: string } | null {
  if (typeof ref === 'string') return null

  const specLabel = ref.label?.trim()
  const value = ref.value?.trim()
  if (!specLabel || !value) return null

  return { specLabel, value }
}

/**
 * The product's own Key Highlights, ready to render.
 *
 * Returns an empty array when the product has none, which is what makes the section
 * disappear instead of falling back to anything.
 */
export function resolveProductHighlights(product: Product): ResolvedProductHighlight[] {
  const rows: ResolvedProductHighlight[] = []

  // Order is the admin's. Duplicate labels are kept rather than collapsed: if the same
  // label was saved twice, that is what was entered, and silently dropping one would be
  // this module editing the data again.
  ;(product.highlights ?? []).forEach((ref, index) => {
    const row = readRow(ref)
    if (!row) return
    rows.push({ key: `highlight-${index}-${row.specLabel}`, ...row })
  })

  return rows
}
