import { readKeyHighlights, type KeyHighlight } from '@/lib/keyHighlights'

/**
 * Derives the product page's feature strip and its fit line from real catalogue data.
 *
 * The strip under the gallery ("Premium / 240 GSM Cotton", "Detailed / Embroidery", …)
 * is not static copy: each tile is one of the admin's own `key_highlights` entries,
 * rendered with `label` as the small eyebrow and `value` as the bold line — which is
 * exactly how those two fields read on every product already configured.
 *
 * `gsm` and `fabric` are separate top-level fields on the product. They are folded in
 * only when the highlights do not already mention them, so a product whose admin wrote a
 * "Premium / 240 GSM Cotton" highlight does not get a second, duplicate fabric tile.
 *
 * Nothing here invents a feature. A product with no highlights and no fabric data yields
 * an empty list and the strip is not rendered at all.
 */

/** A tile in the feature strip. */
export type ProductFeature = {
  /** Small line above — the admin's `label`. */
  eyebrow: string
  /** Bold line — the admin's `value`. */
  text: string
  /** Which icon to draw. Resolved from the label, with a generic fallback. */
  icon: FeatureIconName
}

export type FeatureIconName = 'fabric' | 'stitch' | 'fit' | 'unisex' | 'care' | 'generic'

/**
 * Label keywords → icon. Matched against a normalised label, longest-first, so
 * "Oversized Fit" resolves to `fit` rather than falling through to the generic icon.
 *
 * Adding a product category only means adding a line here; an unmapped label is not an
 * error, it just draws the generic mark.
 */
const ICON_KEYWORDS: { keywords: string[]; icon: FeatureIconName }[] = [
  { keywords: ['fabric', 'material', 'cotton', 'gsm', 'blend', 'weave'], icon: 'fabric' },
  { keywords: ['embroid', 'print', 'stitch', 'detail', 'craft', 'artwork'], icon: 'stitch' },
  { keywords: ['fit', 'silhouette', 'cut', 'oversiz', 'regular'], icon: 'fit' },
  { keywords: ['unisex', 'gender', 'design', 'style'], icon: 'unisex' },
  { keywords: ['wash', 'care', 'maintenance'], icon: 'care' },
]

function normalise(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim()
}

/** Picks the icon for a label. Checks both the label and the value, label first. */
export function iconForHighlight(label: string, value: string): FeatureIconName {
  const haystack = `${normalise(label)} ${normalise(value)}`

  for (const entry of ICON_KEYWORDS) {
    if (entry.keywords.some((keyword) => haystack.includes(keyword))) return entry.icon
  }

  return 'generic'
}

/** True when the highlights already describe the fabric, so `gsm`/`fabric` would repeat it. */
function mentionsFabric(highlights: KeyHighlight[]): boolean {
  return highlights.some((highlight) => iconForHighlight(highlight.label, highlight.value) === 'fabric')
}

/**
 * Builds the fabric tile from the product's own `gsm` and `fabric` fields.
 *
 * Returns null when neither is usable — a `gsm` of 0 is "not recorded", not a real weight,
 * and rendering "0 GSM" would be worse than rendering nothing.
 */
function fabricFeature(gsm: number | null | undefined, fabric: string | null | undefined): ProductFeature | null {
  const weight = typeof gsm === 'number' && Number.isFinite(gsm) && gsm > 0 ? `${gsm} GSM` : ''
  const material = (fabric ?? '').trim()

  const text = [weight, material].filter(Boolean).join(' ')
  if (!text) return null

  return { eyebrow: 'Premium', text, icon: 'fabric' }
}

/**
 * The feature strip, capped at four tiles.
 *
 * Four is a layout constraint, not a data one: the strip is a single row with dividers and
 * a fifth tile wraps badly at every breakpoint. The admin's own ordering decides which
 * four survive, so the ones they put first are the ones shown.
 */
export function buildProductFeatures(
  rawHighlights: unknown,
  gsm?: number | null,
  fabric?: string | null,
  limit = 4,
): ProductFeature[] {
  const highlights = readKeyHighlights(rawHighlights)

  const features: ProductFeature[] = highlights
    .filter((highlight) => highlight.label.trim() || highlight.value.trim())
    .map((highlight) => ({
      eyebrow: highlight.label.trim(),
      text: highlight.value.trim(),
      icon: iconForHighlight(highlight.label, highlight.value),
    }))

  if (!mentionsFabric(highlights)) {
    const fallback = fabricFeature(gsm, fabric)
    // Prepended: fabric is the first thing the design leads with.
    if (fallback) features.unshift(fallback)
  }

  return features.slice(0, limit)
}

/**
 * The single line beside the size selector — "Oversized Fit | Relaxed and comfortable
 * silhouette".
 *
 * It is whichever highlight describes the FIT, because that is the one piece of
 * information a shopper needs at the exact moment they are choosing a size. Returns null
 * when the product has no fit highlight, and the line is then simply not rendered.
 */
export function findFitHighlight(rawHighlights: unknown): KeyHighlight | null {
  const highlights = readKeyHighlights(rawHighlights)

  return (
    highlights.find((highlight) => iconForHighlight(highlight.label, highlight.value) === 'fit' && highlight.value.trim()) ??
    null
  )
}

/** The checklist under "Crafted in Every Stitch" — every highlight, not just four. */
export function buildHighlightChecklist(rawHighlights: unknown): string[] {
  return readKeyHighlights(rawHighlights)
    .map((highlight) => {
      const label = highlight.label.trim()
      const value = highlight.value.trim()
      if (label && value) return `${value}`
      return label || value
    })
    .filter(Boolean)
}
