/**
 * Size-chart resolution — the ONE place the category/subcategory → chart mapping lives.
 *
 * The source of truth is the catalog relationship the admin already maintains:
 * `product.category.name` and `product.sub_category.name`, both present on the product
 * detail response. Nothing here fetches anything, and nothing here inspects the product
 * NAME: guessing from the title would hand the wrong chart to, say, "Oversize Graphic Tee"
 * filed under Regular Fit.
 *
 * Verified live against /v1/categories_management/ and /v1/sub_categories_management/:
 *   T-Shirts -> Oversize, Regular Fit
 *   Shorts   -> Essential Shorts, Cargo Pocket
 *
 * Add a future mapping by adding one line to CATEGORY_CHARTS or SUBCATEGORY_CHARTS below.
 */

/** The three artwork files in `public/images/`. */
export const SIZE_CHART_IMAGES = {
  regular: '/images/Size_chart_regular_polo_fullsleeves.png',
  oversize: '/images/Size_chart_oversize_hoodie_sweatshirt.png',
  shorts: '/images/Size_chart_shorts.png',
} as const

export type SizeChartKey = keyof typeof SIZE_CHART_IMAGES

export type SizeChart = {
  key: SizeChartKey
  src: string
  /** Describes the chart for screen readers and for the image's alt text. */
  alt: string
}

const CHART_ALT: Record<SizeChartKey, string> = {
  regular: 'Size chart for regular fit, polo and full sleeve styles, in inches',
  oversize: 'Size chart for oversize, hoodie and sweatshirt styles, in inches',
  shorts: 'Size chart for shorts, in inches',
}

/**
 * Canonical lookup key: lowercased with every non-alphanumeric character removed.
 *
 * This is still EXACT matching — the whole string is reduced to one key and compared
 * whole, never searched for a substring — it just stops harmless spelling differences
 * from missing: "Regular Fit", " regular fit ", "REGULAR FIT" and "Regular-Fit" all
 * become `regularfit`, and "T-Shirts" / "T Shirts" / "tshirts" all become `tshirts`.
 */
function toKey(value: string | null | undefined): string {
  if (typeof value !== 'string') return ''
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

/**
 * Category-level charts: every current and future subcategory under these uses one chart.
 *
 * T-Shirts is deliberately ABSENT. That category genuinely splits between two charts
 * (Oversize vs Regular Fit), so a T-shirt whose subcategory is not mapped resolves to
 * `null` rather than silently receiving the wrong measurements.
 */
const CATEGORY_CHARTS: Record<string, SizeChartKey> = {
  // Live today. Both Shorts subcategories share one chart, and so will future ones.
  shorts: 'shorts',

  // Planned. Mapped now so no code change is needed when the admin creates them.
  hoodies: 'oversize',
  hoodie: 'oversize',
  sweatshirts: 'oversize',
  sweatshirt: 'oversize',
  fullsleeves: 'regular',
  fullsleeve: 'regular',
  polos: 'regular',
  polo: 'regular',
}

/**
 * Category + subcategory charts, keyed `<category>::<subcategory>`.
 *
 * Checked BEFORE the category table, so a specific pairing always wins over a broad one.
 */
const SUBCATEGORY_CHARTS: Record<string, SizeChartKey> = {
  // Live today.
  'tshirts::oversize': 'oversize',
  'tshirts::regularfit': 'regular',
  'shorts::essentialshorts': 'shorts',
  'shorts::cargopocket': 'shorts',

  // Planned, in case these arrive as T-Shirts subcategories rather than categories.
  'tshirts::fullsleeves': 'regular',
  'tshirts::fullsleeve': 'regular',
  'tshirts::polo': 'regular',
  'tshirts::sweatshirt': 'oversize',
  'tshirts::sweatshirts': 'oversize',

  // Accepted spelling variant: the admin value is "Oversize", but "Oversized" would
  // otherwise silently fall through to null if anyone renames it.
  'tshirts::oversized': 'oversize',
}

/**
 * The chart for a product, or `null` when the pairing has no configured chart.
 *
 * Resolution order is most-specific-first:
 *   1. category + subcategory
 *   2. category alone (covers any subcategory under it, and no subcategory at all)
 *   3. null
 *
 * `null` means the Size Chart control is not shown at all. Unknown categories deliberately
 * do NOT fall back to a default chart — a future category could need different
 * measurements, and showing plausible-but-wrong sizing is worse than showing none.
 */
export function getSizeChart(
  category: string | null | undefined,
  subCategory: string | null | undefined,
): SizeChart | null {
  const categoryKey = toKey(category)
  const subCategoryKey = toKey(subCategory)

  let key: SizeChartKey | undefined

  if (categoryKey && subCategoryKey) {
    key = SUBCATEGORY_CHARTS[`${categoryKey}::${subCategoryKey}`]
  }

  if (!key && categoryKey) {
    key = CATEGORY_CHARTS[categoryKey]
  }

  if (!key) return null

  return { key, src: SIZE_CHART_IMAGES[key], alt: CHART_ALT[key] }
}

/* ------------------------------------------------------- charts from key highlights */

/**
 * Why a second source exists.
 *
 * `getSizeChart` reads category + subcategory, and for T-shirts it deliberately refuses to
 * answer on the category alone: the block depends on the FIT, and showing regular-fit
 * measurements for an oversize tee would be worse than showing none. That worked while
 * subcategories WERE fits ("Oversize", "Regular Fit").
 *
 * The catalogue's subcategories are now print methods — "Print" and "Embroidery" — which
 * say nothing about fit. So every T-shirt resolves to `null` and loses its Size Chart
 * button, while Shorts keeps one through the category table.
 *
 * The fit did not disappear with it: the product still carries it, in the key highlight the
 * admin form already fills in from its predefined rows — `{ label: "Fit", value: "Regular
 * Fit" }` alongside `{ label: "Product Type", value: "T-Shirt" }`. These tables read that,
 * so the chart follows the product's own description instead of a taxonomy that no longer
 * describes shape.
 */

/** Garments with their own block, whatever fit is recorded against them. */
const GARMENT_TYPE_CHARTS: Record<string, SizeChartKey> = {
  shorts: 'shorts',
  hoodie: 'oversize',
  hoodies: 'oversize',
  sweatshirt: 'oversize',
  sweatshirts: 'oversize',
}

/** Fit, which is what separates the two top blocks. */
const FIT_CHARTS: Record<string, SizeChartKey> = {
  oversize: 'oversize',
  oversized: 'oversize',
  regularfit: 'regular',
  regular: 'regular',
}

/** Remaining product types, used only when no fit was recorded. */
const PRODUCT_TYPE_CHARTS: Record<string, SizeChartKey> = {
  tshirt: 'regular',
  tshirts: 'regular',
  fullsleevetshirt: 'regular',
  fullsleeve: 'regular',
  fullsleeves: 'regular',
  polo: 'regular',
  polos: 'regular',
}

/** The `{ label, value }` rows this resolver needs. The product's own highlights fit. */
export type SizeChartHighlight = {
  label: string
  value: string
}

function chartFor(key: SizeChartKey | undefined): SizeChart | null {
  if (!key) return null
  return { key, src: SIZE_CHART_IMAGES[key], alt: CHART_ALT[key] }
}

/**
 * The chart for a product, from its taxonomy first and its key highlights second.
 *
 * Order is deliberate:
 *   1. category + subcategory, unchanged — anything that resolves today keeps resolving,
 *      including Shorts and any legacy fit-named subcategory;
 *   2. product type, where the garment has its own block (shorts, hoodie, sweatshirt);
 *   3. fit, which decides between the two top blocks;
 *   4. the remaining product types, for a product with no fit recorded.
 *
 * Still `null` when nothing matches, so a product that genuinely has no configured chart
 * shows no button rather than the wrong measurements — the original rule is intact.
 */
export function getSizeChartForProduct(
  category: string | null | undefined,
  subCategory: string | null | undefined,
  highlights: readonly SizeChartHighlight[] | null | undefined,
): SizeChart | null {
  const byTaxonomy = getSizeChart(category, subCategory)
  if (byTaxonomy) return byTaxonomy

  const rows = highlights ?? []
  const valueOf = (label: string) => {
    const wanted = toKey(label)
    const row = rows.find((entry) => toKey(entry.label) === wanted)
    return toKey(row?.value)
  }

  const productType = valueOf('Product Type')
  const fit = valueOf('Fit')

  return (
    chartFor(GARMENT_TYPE_CHARTS[productType]) ??
    chartFor(FIT_CHARTS[fit]) ??
    chartFor(PRODUCT_TYPE_CHARTS[productType])
  )
}
