import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProductCard } from '@/components/ProductCard'
import { ShopSortPicker } from '@/components/shop/ShopSortPicker'
import { ProductGridSkeleton } from '@/components/shop/ProductGridSkeleton'
import {
  SIZE_OPTIONS,
  ShopFilterBar,
  priceBucketFromRange,
  priceRangeFromBucket,
  type SubCategoryOption,
} from '@/components/shop/ShopFilterBar'
import { Button } from '@/components/ui/Button'

import {
  getAllProducts,
  getProductsPageList,
  readProductApiError,
  type ProductQueryParams,
  type ProductSortBy,
} from '@/api/product'
import { getCategories } from '@/api/category'
import type { Product } from '@/types'
import { mapProduct } from '@/mappers/productMapper'
import { categoryNameToSlug } from '@/lib/categorySlug'
import type { CategoryDto } from '@/types/api/CategoryDto'
import type { SortKey } from '@/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const SORT_KEYS = new Set<SortKey>(['popular', 'new-arrival', 'bestseller', 'price-asc', 'price-desc'])

function parseSort(raw: string | null): SortKey {
  if (raw && SORT_KEYS.has(raw as SortKey)) return raw as SortKey
  return 'popular'
}

/**
 * Products per request. 20 matches the backend's own default, so the first screenful is
 * exactly what the Shop page has always shown — infinite scroll only adds what comes
 * after it, rather than changing the initial render.
 */
const SHOP_PAGE_SIZE = 20

/**
 * Sort options the BACKEND can order, verified live (2026-10-05).
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
 * `new-arrival` and `bestseller` are absent on purpose: the backend has no equivalent
 * (it silently ignores unknown `sort_by` values), so those two stay client-side below.
 */
const SERVER_SORTS: Partial<Record<SortKey, ProductSortBy>> = {
  popular: 'display_order',
  'price-asc': 'price_low_to_high',
  'price-desc': 'price_high_to_low',
}

/** Appends a page, dropping any id already present so an overlapping page cannot duplicate a card. */
function appendUnique(previous: Product[], incoming: Product[]): Product[] {
  const seen = new Set(previous.map((p) => p.id))
  return [...previous, ...incoming.filter((p) => !seen.has(p.id))]
}

export function ShopPage() {
  useDocumentTitle('Shop')
  const [searchParams, setSearchParams] = useSearchParams()

  const [categories, setCategories] = useState<CategoryDto[]>([])
  /**
   * The FULL catalogue, used only to derive Sub Category options — never to render the
   * grid. It is fetched across every page (`getAllProducts`) because a sub-category whose
   * products all sit on page 2 would otherwise never appear as a filter option, and
   * because deriving the options from the currently-filtered grid would make them
   * shrink and flicker as Size/Search change.
   */
  const [facetProducts, setFacetProducts] = useState<Product[]>([])
  const [catalogReady, setCatalogReady] = useState(false)

  /** The accumulated grid: page 1, plus every page infinite scroll has appended. */
  const [products, setProducts] = useState<Product[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasNext, setHasNext] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)


  /** Newest request wins — a slow page-2 append can never land after a filter change. */
  const requestIdRef = useRef(0)
  /** Synchronous guard so scrolling cannot fire two "load next page" requests at once. */
  const inFlightRef = useRef(false)
  /** The highest page actually loaded for the current query. */
  const pageRef = useRef(1)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let active = true

    Promise.all([getAllProducts(), getCategories()])
      .then(([dtos, categoryList]) => {
        if (!active) return
        setFacetProducts(dtos.map(mapProduct))
        setCategories(categoryList)
      })
      .catch(() => {
        // The grid has its own error surface; losing the facet source only costs the
        // Sub Category options, so the page still works with the remaining filters.
      })
      .finally(() => {
        if (active) setCatalogReady(true)
      })

    return () => {
      active = false
    }
  }, [])

  const allowedCategorySlugs = useMemo(
    () => new Set(categories.map((c) => categoryNameToSlug(c.name))),
    [categories],
  )

  const q = searchParams.get('q') ?? ''
  const categoryRaw = searchParams.get('category')
  const category = categoryRaw && allowedCategorySlugs.has(categoryRaw) ? categoryRaw : 'all'
  const sort = parseSort(searchParams.get('sort'))

  const sortBy: ProductSortBy | undefined = SERVER_SORTS[sort]

  const categoryHeading =
    category === 'all' ? 'All Products' : (categories.find((c) => categoryNameToSlug(c.name) === category)?.name ?? 'All Products')

  const subCategoryOptions: SubCategoryOption[] = useMemo(() => {
    const scoped = category === 'all' ? facetProducts : facetProducts.filter((p) => p.categorySlug === category)
    const bySlug = new Map<string, SubCategoryOption>()
    for (const p of scoped) {
      if (p.subCategorySlug && p.subCategoryName && p.subCategoryId != null && !bySlug.has(p.subCategorySlug)) {
        bySlug.set(p.subCategorySlug, { slug: p.subCategorySlug, name: p.subCategoryName, id: p.subCategoryId })
      }
    }
    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [facetProducts, category])

  const subCategoryRaw = searchParams.get('subcategory')
  const subcategory =
    subCategoryRaw && subCategoryOptions.some((s) => s.slug === subCategoryRaw) ? subCategoryRaw : 'all'

  const sizeRaw = searchParams.get('size')
  const size = sizeRaw && SIZE_OPTIONS.includes(sizeRaw) ? sizeRaw : 'all'

  const minP = searchParams.get('min')
  const maxP = searchParams.get('max')
  const minFromUrl = minP != null && minP !== '' && Number.isFinite(Number(minP)) ? Number(minP) : null
  const maxFromUrl = maxP != null && maxP !== '' && Number.isFinite(Number(maxP)) ? Number(maxP) : null
  const priceBucket = priceBucketFromRange(minFromUrl, maxFromUrl)

  const updateParams = useCallback(
    (mutate: (n: URLSearchParams) => void, opts?: { replace?: boolean }) => {
      setSearchParams(
        (prev) => {
          const n = new URLSearchParams(prev)
          mutate(n)
          return n
        },
        opts,
      )
    },
    [setSearchParams],
  )

  // Clear an invalid subcategory whenever it no longer belongs to the current category's options.
  // Gated on `catalogReady` so a deep-linked `?subcategory=` isn't wiped before the catalog
  // (and therefore subCategoryOptions) has actually loaded.
  useEffect(() => {
    if (!catalogReady) return
    const current = searchParams.get('subcategory')
    if (!current || current === 'all') return
    if (!subCategoryOptions.some((s) => s.slug === current)) {
      updateParams((n) => n.delete('subcategory'), { replace: true })
    }
  }, [catalogReady, subCategoryOptions, searchParams, updateParams])

  /**
   * Everything the SERVER is responsible for, resolved once into the exact query params.
   *
   * Kept as a single memoized object (rather than four loose consts) so the request
   * callback below has one stable dependency instead of five derived ones.
   */
  const serverParams = useMemo<ProductQueryParams>(() => {
    const categoryId =
      category !== 'all' ? categories.find((c) => categoryNameToSlug(c.name) === category)?.id : undefined
    const subCategoryId =
      subcategory !== 'all' ? subCategoryOptions.find((s) => s.slug === subcategory)?.id : undefined

    return {
      ...(categoryId != null ? { category_id: categoryId } : {}),
      ...(subCategoryId != null ? { sub_category_id: subCategoryId } : {}),
      ...(size !== 'all' ? { size } : {}),
      ...(q.trim() ? { search: q.trim() } : {}),
      ...(sortBy ? { sort_by: sortBy } : {}),
    }
  }, [categories, category, subCategoryOptions, subcategory, size, q, sortBy])

  /**
   * The same query as one stable string.
   *
   * Used as the reset effect's dependency so the grid returns to page 1 exactly when the
   * server query actually changes — switching between the two client-sorted options, or
   * moving the price bucket, never throws away pages that are already loaded and valid.
   */
  const serverQueryKey = JSON.stringify(serverParams)

  const loadPage = useCallback(
    async (targetPage: number, mode: 'replace' | 'append') => {
      // A filter change ('replace') always wins; only scroll-driven appends back off.
      if (mode === 'append' && inFlightRef.current) return

      const requestId = ++requestIdRef.current
      inFlightRef.current = true

      if (mode === 'replace') {
        setListLoading(true)
        setLoadError(null)
      } else {
        setLoadingMore(true)
      }

      try {
        const { products: dtos, pagination } = await getProductsPageList({
          ...serverParams,
          page: targetPage,
          page_size: SHOP_PAGE_SIZE,
        })
        // A newer query superseded this one — drop the result rather than mixing two
        // different filter sets into one grid.
        if (requestId !== requestIdRef.current) return

        const mapped = dtos.map(mapProduct)
        setProducts((previous) => (mode === 'replace' ? mapped : appendUnique(previous, mapped)))
        // Paging follows the response's own `has_next`; nothing is inferred from counts,
        // so a backend that stops reporting it simply stops the infinite scroll.
        setHasNext(pagination?.has_next === true && mapped.length > 0)
        setLoadError(null)
        pageRef.current = targetPage
      } catch (error) {
        if (requestId !== requestIdRef.current) return
        setLoadError(readProductApiError(error, 'Unable to load products.'))
        if (mode === 'replace') {
          // A failed request is an error state, never an empty product list.
          setProducts([])
          setHasNext(false)
        } else {
          // Keep what is already on screen and stop auto-loading, so a failing request
          // cannot be retried forever by the scroll observer.
          setHasNext(false)
        }
      } finally {
        if (requestId === requestIdRef.current) {
          inFlightRef.current = false
          setListLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [serverParams],
  )

  // Reset to page 1 whenever the server query changes.
  useEffect(() => {
    if (!catalogReady) return
    pageRef.current = 1
    void loadPage(1, 'replace')
    // `loadPage` is rebuilt from the same inputs `serverQueryKey` encodes; the key is the
    // dependency so an identical query never refires.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogReady, serverQueryKey])

  const loadMore = useCallback(() => {
    if (!hasNext || inFlightRef.current) return
    void loadPage(pageRef.current + 1, 'append')
  }, [hasNext, loadPage])

  /**
   * Infinite scroll.
   *
   * A sentinel below the grid is watched with IntersectionObserver and a 400px bottom
   * margin, so the next page starts loading just BEFORE the shopper reaches the end of
   * the current one and the new rows are usually there by the time they arrive.
   *
   * The observer also fires when the sentinel is already on screen without any scrolling,
   * which is what makes the client-side price filter converge: if the loaded pages leave
   * only a few visible cards, the sentinel stays in view and the next page loads straight
   * away, repeating until the server reports no more pages.
   */
  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return

    if (typeof IntersectionObserver === 'undefined') return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore()
      },
      { rootMargin: '400px 0px' },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [loadMore])

  const priceRange = priceRangeFromBucket(priceBucket)

  const list = useMemo(() => {
    let filtered = [...products]

    // Price stays a CLIENT filter, matching the displayed price. (The backend does accept
    // min_price/max_price, but it matches any VARIANT in range, so a ₹1,299 product with
    // one ₹1 variant would appear under "below ₹900" — a different, more surprising
    // result than the one this page has always shown.) As pages load, this converges on
    // the whole catalogue instead of only the first 20 rows.
    if (priceRange.min != null) filtered = filtered.filter((p) => p.price >= priceRange.min!)
    if (priceRange.max != null) filtered = filtered.filter((p) => p.price <= priceRange.max!)

    switch (sort) {
      case 'price-asc':
        // Already ordered by the server; re-applying it here is a no-op that keeps the
        // grid correct even if a response ever arrives unsorted.
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
  }, [products, priceRange.min, priceRange.max, sort])

  const setSort = useCallback(
    (key: SortKey) => {
      updateParams((n) => {
        if (key === 'popular') n.delete('sort')
        else n.set('sort', key)
      })
    },
    [updateParams],
  )

  const resetAllFilters = useCallback(() => {
    updateParams((n) => {
      n.delete('q')
      n.delete('category')
      n.delete('subcategory')
      n.delete('size')
      n.delete('min')
      n.delete('max')
      n.delete('sort')
    })
  }, [updateParams])

  const hasActiveFilters =
    Boolean(q.trim()) ||
    category !== 'all' ||
    subcategory !== 'all' ||
    size !== 'all' ||
    priceBucket !== 'all' ||
    sort !== 'popular'

  const showProductLoading = !catalogReady || listLoading
  /** "Nothing matched" is only true once there is nothing left to load. */
  const showEmptyState = !showProductLoading && list.length === 0 && !hasNext && !loadError

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="type-page-title">{categoryHeading}</h1>

      {/* `items-start` so the Sort control lines up with the filter selects: the filter
          bar carries its own `pb-6` + bottom rule, so centring the row pushed Sort ~12px
          below the others. */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <ShopFilterBar
          categories={categories}
          category={category}
          onCategoryChange={(slug) => updateParams((n) => (slug === 'all' ? n.delete('category') : n.set('category', slug)))}
          subCategoryOptions={subCategoryOptions}
          subCategory={subcategory}
          onSubCategoryChange={(slug) => updateParams((n) => (slug === 'all' ? n.delete('subcategory') : n.set('subcategory', slug)))}
          subCategoryDisabled={subCategoryOptions.length === 0}
          size={size}
          onSizeChange={(s) => updateParams((n) => (s === 'all' ? n.delete('size') : n.set('size', s)))}
          priceBucket={priceBucket}
          onPriceBucketChange={(bucket) =>
            updateParams((n) => {
              const { min, max } = priceRangeFromBucket(bucket)
              if (min == null) n.delete('min')
              else n.set('min', String(min))
              if (max == null) n.delete('max')
              else n.set('max', String(max))
            })
          }
          onReset={resetAllFilters}
        />

        <ShopSortPicker sort={sort} onSelect={setSort} />
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {showProductLoading ? (
          <ProductGridSkeleton count={8} />
        ) : showEmptyState ? (
          <div className="col-span-full px-4 py-12 text-center">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">No product for this choice.</p>
            {hasActiveFilters ? (
              <Button type="button" className="mt-5" onClick={resetAllFilters}>
                Reset Filter
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            {list.map((p) => <ProductCard key={p.id} product={p} variant="homepage" />)}
            {/* Placeholders for the page being fetched, so the grid grows downward
                instead of the footer jumping up as rows arrive. */}
            {loadingMore ? <ProductGridSkeleton count={4} /> : null}
          </>
        )}
      </div>

      {/*
        The infinite-scroll sentinel. Rendered only while the server says there is another
        page, so it disappears at the end of the catalogue rather than observing forever.

        The button inside it is not decoration: IntersectionObserver drives the normal
        case, but the button keeps the rest of the catalogue reachable by keyboard, for a
        screen-reader user who never scrolls the sentinel into view, and in any browser
        where the observer is unavailable.
      */}
      {!showProductLoading && hasNext ? (
        <div ref={sentinelRef} className="mt-10 flex justify-center">
          <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load More Products'}
          </Button>
        </div>
      ) : null}

      {loadError ? (
        <div className="mt-8 border border-zinc-200 bg-[#f7f7f5] p-6 text-center" role="alert">
          <p className="text-sm text-zinc-700">{loadError}</p>
          <Button type="button" className="mt-4" onClick={() => void loadPage(pageRef.current, 'replace')}>
            Try Again
          </Button>
        </div>
      ) : null}

      {/* Announces each batch to assistive tech, which otherwise gets no signal that the
          page grew under the shopper. */}
      <p className="sr-only" role="status" aria-live="polite">
        {showProductLoading ? 'Loading products' : `Showing ${list.length} products`}
      </p>
    </div>
  )
}
