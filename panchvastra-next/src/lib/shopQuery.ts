import type { CategoryDto } from '@/types/api/CategoryDto'
import type { ProductQueryParams, ProductSortBy } from '@/types/api/ProductQuery'
import type { SortKey } from '@/types'
import { categoryNameToSlug } from '@/lib/categorySlug'

/**
 * Everything the Shop page's URL means, in one module.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS AND WHY IT IS SHARED
 * ──────────────────────────────────────────────────────────────────────────────
 * In the Vite app this logic lives inside `ShopPage` because there is only one place that
 * needs it. Here the same URL has to be read TWICE — once on the server, to fetch page 1
 * and render it into the HTML, and once in the browser, so the filter controls know what
 * is selected and infinite scroll can ask for page 2 of the SAME query.
 *
 * Two readings of one URL is exactly the kind of thing that drifts: a server that resolves
 * `?category=hoodie&sort=price-asc` to one request and a client that resolves it to a
 * slightly different one produces a grid whose page 2 does not belong with its page 1, and
 * nothing fails loudly. So the parsing lives here, both sides import it, and they cannot
 * disagree.
 *
 * Every rule below is carried over from the Vite `ShopPage` unchanged — the validation
 * against the real category list, the price buckets, which sorts the server can do, and
 * the 20-per-page size.
 */

/** Products per request. 20 matches the backend's own default. */
export const SHOP_PAGE_SIZE = 20

const SORT_KEYS = new Set<SortKey>(['popular', 'new-arrival', 'bestseller', 'price-asc', 'price-desc'])

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: 'Featured' },
  { key: 'new-arrival', label: 'New Arrivals' },
  { key: 'bestseller', label: 'Best Selling' },
  { key: 'price-asc', label: 'Price Low to High' },
  { key: 'price-desc', label: 'Price High to Low' },
]

export function parseSort(raw: string | null | undefined): SortKey {
  if (raw && SORT_KEYS.has(raw as SortKey)) return raw as SortKey
  return 'popular'
}

/**
 * Sort options the BACKEND can order, verified live by the Vite app (2026-10-05).
 *
 * This matters specifically because the list is paginated: a sort applied on the client
 * can only ever order the pages already loaded, so appending page 2 would shuffle rows
 * the shopper has already scrolled past. Asking the server keeps one global order across
 * every page.
 *
 * `price_low_to_high` / `price_high_to_low` order by the backend's `selling_price` — the
 * exact field `mapProduct` puts in `product.price` and the card displays — so moving these
 * off the client changes correctness, not the visible ordering.
 *
 * `new-arrival` and `bestseller` are absent on purpose: the backend has no equivalent (it
 * silently ignores unknown `sort_by` values), so those two stay client-side.
 */
const SERVER_SORTS: Partial<Record<SortKey, ProductSortBy>> = {
  popular: 'display_order',
  'price-asc': 'price_low_to_high',
  'price-desc': 'price_high_to_low',
}

/**
 * Fixed apparel size scale — the product LIST endpoint does not expose a "sizes available"
 * facet to derive this from. The selection itself IS genuinely backend-filtered, via the
 * verified-real `size` query parameter.
 */
export const SIZE_OPTIONS = ['S', 'M', 'L', 'XL', 'XXL']

type PriceBucket = { value: string; label: string; min: number | null; max: number | null }

/**
 * The backend does not support server-side price filtering (`min_price` / `max_price` /
 * `price_min` / `price_max` were all verified as silently ignored), so price stays a
 * client-side filter. Buckets resolve to the same `min` / `max` URL parameters the
 * existing filtering logic already reads.
 */
export const PRICE_BUCKETS: PriceBucket[] = [
  { value: 'all', label: 'All Prices', min: null, max: null },
  { value: 'under-1000', label: 'Under ₹1,000', min: null, max: 999 },
  { value: '1000-1500', label: '₹1,000 – ₹1,500', min: 1000, max: 1500 },
  { value: '1500-2000', label: '₹1,500 – ₹2,000', min: 1500, max: 2000 },
  { value: '2000-plus', label: '₹2,000+', min: 2000, max: null },
]

export function priceBucketFromRange(min: number | null, max: number | null): string {
  const hit = PRICE_BUCKETS.find((b) => b.min === min && b.max === max)
  return hit?.value ?? 'all'
}

export function priceRangeFromBucket(value: string): { min: number | null; max: number | null } {
  const bucket = PRICE_BUCKETS.find((b) => b.value === value)
  return { min: bucket?.min ?? null, max: bucket?.max ?? null }
}

export type SubCategoryOption = { slug: string; name: string; id: number }

/** A URL-ish object both `URLSearchParams` and Next's resolved `searchParams` satisfy. */
export type ReadParam = (key: string) => string | null

/** Reads Next's `{ [key: string]: string | string[] | undefined }` as a single value. */
export function readerFor(params: Record<string, string | string[] | undefined>): ReadParam {
  return (key) => {
    const value = params[key]
    if (Array.isArray(value)) return value[0] ?? null
    return value ?? null
  }
}

export type ShopSelection = {
  q: string
  /** A validated category slug, or `'all'`. */
  category: string
  /** A validated sub-category slug, or `'all'`. */
  subcategory: string
  /** One of `SIZE_OPTIONS`, or `'all'`. */
  size: string
  priceBucket: string
  sort: SortKey
  /** Exactly the query the backend is asked for. */
  serverParams: ProductQueryParams
  /**
   * The server query as one stable string. Two URLs with the same key need the SAME
   * backend request, which is what lets the browser skip re-fetching when only a
   * client-side refinement (price band, or a client-only sort) changed.
   */
  serverKey: string
  /** True when anything at all is narrowing or reordering the grid. */
  hasActiveFilters: boolean
}

/**
 * Resolves a Shop URL against the real catalogue.
 *
 * `category` and `subcategory` are validated against the lists they must belong to — a
 * slug that is not a real category falls back to `'all'`, exactly as the Vite page does,
 * so a stale or hand-typed link shows the full catalogue instead of an empty grid.
 */
export function resolveShopSelection(
  read: ReadParam,
  categories: CategoryDto[],
  subCategoryOptions: SubCategoryOption[],
): ShopSelection {
  const q = read('q') ?? ''

  const allowedCategorySlugs = new Set(categories.map((c) => categoryNameToSlug(c.name)))
  const categoryRaw = read('category')
  const category = categoryRaw && allowedCategorySlugs.has(categoryRaw) ? categoryRaw : 'all'

  const subCategoryRaw = read('subcategory')
  const subcategory =
    subCategoryRaw && subCategoryOptions.some((s) => s.slug === subCategoryRaw) ? subCategoryRaw : 'all'

  const sizeRaw = read('size')
  const size = sizeRaw && SIZE_OPTIONS.includes(sizeRaw) ? sizeRaw : 'all'

  const minP = read('min')
  const maxP = read('max')
  const minFromUrl = minP != null && minP !== '' && Number.isFinite(Number(minP)) ? Number(minP) : null
  const maxFromUrl = maxP != null && maxP !== '' && Number.isFinite(Number(maxP)) ? Number(maxP) : null
  const priceBucket = priceBucketFromRange(minFromUrl, maxFromUrl)

  const sort = parseSort(read('sort'))
  const sortBy = SERVER_SORTS[sort]

  const categoryId =
    category !== 'all' ? categories.find((c) => categoryNameToSlug(c.name) === category)?.id : undefined
  const subCategoryId =
    subcategory !== 'all' ? subCategoryOptions.find((s) => s.slug === subcategory)?.id : undefined

  const serverParams: ProductQueryParams = {
    ...(categoryId != null ? { category_id: categoryId } : {}),
    ...(subCategoryId != null ? { sub_category_id: subCategoryId } : {}),
    ...(size !== 'all' ? { size } : {}),
    ...(q.trim() ? { search: q.trim() } : {}),
    ...(sortBy ? { sort_by: sortBy } : {}),
  }

  return {
    q,
    category,
    subcategory,
    size,
    priceBucket,
    sort,
    serverParams,
    // Key order is fixed by the literal above, so the same selection always stringifies
    // the same way.
    serverKey: JSON.stringify(serverParams),
    hasActiveFilters:
      Boolean(q.trim()) ||
      category !== 'all' ||
      subcategory !== 'all' ||
      size !== 'all' ||
      priceBucket !== 'all' ||
      sort !== 'popular',
  }
}

/**
 * The Sub Category options for a category, derived from the catalogue.
 *
 * Derived from the FULL product list rather than the current grid: a sub-category whose
 * products all sit on page 2 would otherwise never appear as an option, and deriving them
 * from the filtered grid would make the options shrink and flicker as Size or Search
 * change.
 */
export function subCategoryOptionsFor(facetProducts: { categorySlug: string; subCategorySlug?: string; subCategoryName?: string; subCategoryId?: number }[], category: string): SubCategoryOption[] {
  const scoped = category === 'all' ? facetProducts : facetProducts.filter((p) => p.categorySlug === category)
  const bySlug = new Map<string, SubCategoryOption>()

  for (const p of scoped) {
    if (p.subCategorySlug && p.subCategoryName && p.subCategoryId != null && !bySlug.has(p.subCategorySlug)) {
      bySlug.set(p.subCategorySlug, { slug: p.subCategorySlug, name: p.subCategoryName, id: p.subCategoryId })
    }
  }

  return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/** The page heading: the selected category's real name, or "All Products". */
export function categoryHeadingFor(categories: CategoryDto[], category: string): string {
  if (category === 'all') return 'All Products'
  return categories.find((c) => categoryNameToSlug(c.name) === category)?.name ?? 'All Products'
}

/**
 * The client-side half of the list: the price band, then the sorts the backend cannot do.
 *
 * Price stays a CLIENT filter, matching the DISPLAYED price. (The backend does accept
 * `min_price`/`max_price`, but it matches any VARIANT in range, so a ₹1,299 product with
 * one ₹1 variant would appear under "below ₹900" — a different, more surprising result
 * than the one this page has always shown.) As pages load, this converges on the whole
 * catalogue instead of only the first 20 rows.
 */
export function applyClientRefinements<T extends { price: number; isNew?: boolean; reviewCount: number }>(
  products: T[],
  priceBucket: string,
  sort: SortKey,
): T[] {
  const { min, max } = priceRangeFromBucket(priceBucket)
  let filtered = [...products]

  if (min != null) filtered = filtered.filter((p) => p.price >= min)
  if (max != null) filtered = filtered.filter((p) => p.price <= max)

  switch (sort) {
    case 'price-asc':
      // Already ordered by the server; re-applying it here is a no-op that keeps the grid
      // correct even if a response ever arrives unsorted.
      filtered.sort((a, b) => a.price - b.price)
      break
    case 'price-desc':
      filtered.sort((a, b) => b.price - a.price)
      break
    case 'new-arrival':
      // No server equivalent for the admin's `is_new_arrival` flag, so this stays on the
      // client and floats flagged products to the top of whatever has loaded.
      filtered.sort((a, b) => Number(b.isNew) - Number(a.isNew))
      break
    case 'bestseller':
      filtered.sort((a, b) => b.reviewCount - a.reviewCount)
      break
    default:
      // Featured: the backend already returned the curated order, preserved as received.
      break
  }

  return filtered
}
