import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ProductCard } from '@/components/ProductCard'
import { IconFilterPeek } from '@/components/shop/IconFilterPeek'
import { PriceFilterSection } from '@/components/shop/PriceFilterSection'
import { SizeFilterDropdown } from '@/components/shop/SizeFilterDropdown'
import { ShopSortPicker } from '@/components/shop/ShopSortPicker'
import { ProductGridSkeleton } from '@/components/shop/ProductGridSkeleton'
import { shopToolbarButtonClass, shopToolbarLabelClass } from '@/components/shop/shopToolbar'
import { Button } from '@/components/ui/Button'
import { useCatalog } from '@/hooks/useCatalog'
import { useCatalogHydrated } from '@/hooks/useCatalogHydrated'
import { catalogApi } from '@/lib/api'
import { getProductsSnapshot } from '@/lib/catalogStore'
import type { CategorySlug } from '@/types'
import type { Product } from '@/types'
import type { SortKey } from '@/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

const PRICE_FLOOR = 0

const SORT_KEYS = new Set<SortKey>(['popular', 'new-arrival', 'bestseller', 'price-asc', 'price-desc'])

function parseSort(raw: string | null): SortKey {
  if (raw && SORT_KEYS.has(raw as SortKey)) return raw as SortKey
  return 'popular'
}

function validCategory(
  c: string | null,
  allowedSlugs: Set<string>,
): CategorySlug | 'all' {
  if (!c || c === 'all') return 'all'
  return allowedSlugs.has(c) ? c : 'all'
}

export function ShopPage() {
  useDocumentTitle('Shop')
  const [searchParams, setSearchParams] = useSearchParams()
  const catalogHydrated = useCatalogHydrated()
  const { categories, revision, products } = useCatalog()
  const allowedSlugs = useMemo(
    () => new Set(categories.map((c) => c.slug)),
    [categories],
  )

  const q = searchParams.get('q') ?? ''
  const category = validCategory(searchParams.get('category'), allowedSlugs)
  const sort = parseSort(searchParams.get('sort'))
  const minP = searchParams.get('min')
  const maxP = searchParams.get('max')
  const sizesRaw = searchParams.get('sizes') ?? ''
  const sizesParam = useMemo(
    () => sizesRaw.split(',').filter(Boolean),
    [sizesRaw],
  )

  const priceBounds = useMemo(() => {
    const products = getProductsSnapshot()
    if (!products.length) return { max: 2000 }
    const maxPrice = Math.max(...products.map((p) => p.price))
    const rounded = Math.max(500, Math.ceil(maxPrice / 100) * 100)
    return { max: rounded }
  }, [revision])

  const boundMin = PRICE_FLOOR
  const boundMax = priceBounds.max

  const minFromUrl =
    minP != null && minP !== '' && Number.isFinite(Number(minP)) ? Number(minP) : null
  const maxFromUrl =
    maxP != null && maxP !== '' && Number.isFinite(Number(maxP)) ? Number(maxP) : null

  const apiMinPrice =
    minFromUrl != null && minFromUrl > boundMin ? minFromUrl : undefined
  const apiMaxPrice =
    maxFromUrl != null && maxFromUrl < boundMax ? maxFromUrl : undefined

  const [list, setList] = useState<Product[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)

  const categoryHeading = useMemo(() => {
    if (category === 'all') return 'All products'
    const def = categories.find((c) => c.slug === category)
    return def?.label ?? def?.shortLabel ?? 'Shop'
  }, [category, categories])

  const setSort = useCallback(
    (key: SortKey) => {
      const n = new URLSearchParams(searchParams)
      if (key === 'popular') n.delete('sort')
      else n.set('sort', key)
      setSearchParams(n)
    },
    [searchParams, setSearchParams],
  )

  const refresh = useCallback(() => {
    catalogApi
      .getProducts({
        category,
        q,
        sort: sort ?? 'popular',
        minPrice: apiMinPrice,
        maxPrice: apiMaxPrice,
        sizes: sizesParam.length ? sizesParam : undefined,
      })
      .then((r) => setList(r.products))
  }, [category, q, sort, apiMinPrice, apiMaxPrice, sizesParam, revision])

  const showProductLoading = !catalogHydrated && products.length === 0

  useEffect(() => {
    if (showProductLoading) return
    refresh()
  }, [refresh, showProductLoading])

  const hasUrlFilters =
    Boolean(q.trim()) ||
    sizesParam.length > 0 ||
    Boolean(minP) ||
    Boolean(maxP) ||
    (sort !== 'popular' && sort != null) ||
    Boolean(searchParams.get('category') && searchParams.get('category') !== 'all')

  const productGridClass = filtersOpen
    ? 'grid gap-5 sm:grid-cols-2 lg:grid-cols-3'
    : 'grid gap-5 sm:grid-cols-2 lg:grid-cols-4'

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div>
        <h1 className="type-page-title">
          {categoryHeading}
        </h1>
      </div>

      <div className="mt-6 flex items-center justify-between gap-4">
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="shop-filters"
          onClick={() => {
            setFiltersOpen((x) => !x)
            setSortMenuOpen(false)
          }}
          className={shopToolbarButtonClass}
        >
          <IconFilterPeek open={filtersOpen} className="h-8 w-8 shrink-0" />
          <span className={shopToolbarLabelClass}>
            Filters
            {/* <span className="text-zinc-600 dark:text-zinc-300">
              {filtersOpen ? 'ON' : 'OFF'}
            </span> */}
          </span>
        </button>

        <ShopSortPicker
          sort={sort}
          open={sortMenuOpen}
          onOpenChange={(next) => {
            setSortMenuOpen(next)
            if (next) setFiltersOpen(false)
          }}
          onSelect={setSort}
        />
      </div>

      <div
        className={`mt-4 grid gap-6 ${filtersOpen ? 'lg:grid-cols-[260px_1fr]' : ''}`}
      >
        <aside
          id="shop-filters"
          aria-hidden={!filtersOpen}
          className={`rounded-2xl border border-zinc-200 bg-white px-4 py-1 dark:border-zinc-800 dark:bg-zinc-950/80 ${filtersOpen ? 'block' : 'hidden'}`}
        >
          <SizeFilterDropdown
            selected={sizesParam}
            onChange={(sizes) => {
              const n = new URLSearchParams(searchParams)
              if (sizes.length) n.set('sizes', sizes.join(','))
              else n.delete('sizes')
              setSearchParams(n)
            }}
          />
          <PriceFilterSection
            boundMin={boundMin}
            boundMax={boundMax}
            minUrl={minFromUrl}
            maxUrl={maxFromUrl}
            onCommit={(min, max) => {
              const n = new URLSearchParams(searchParams)
              if (min == null) n.delete('min')
              else n.set('min', String(min))
              if (max == null) n.delete('max')
              else n.set('max', String(max))
              setSearchParams(n)
            }}
          />
          <div className="pt-2 pb-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full dark:!border-zinc-600 dark:!text-zinc-200"
              onClick={() => {
                const n = new URLSearchParams(searchParams)
                n.delete('min')
                n.delete('max')
                n.delete('sizes')
                n.delete('sort')
                setSearchParams(n)
              }}
            >
              Reset filters
            </Button>
          </div>
        </aside>

        <div className={`min-w-0 ${productGridClass}`}>
          {showProductLoading ? (
            <ProductGridSkeleton count={filtersOpen ? 6 : 8} />
          ) : list.length === 0 ? (
            <div className="col-span-full rounded-2xl border border-zinc-200 bg-zinc-50 px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-950/50">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">No products to show.</p>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {hasUrlFilters
                  ? 'Try clearing filters — size, price range, search, or category can hide everything.'
                  : 'Add products from Admin → Products or reset the catalog seed from the CMS dashboard.'}
              </p>
              {hasUrlFilters ? (
                <Button
                  type="button"
                  className="mt-6"
                  onClick={() =>
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev)
                      next.delete('q')
                      next.delete('sizes')
                      next.delete('min')
                      next.delete('max')
                      next.delete('category')
                      next.delete('sort')
                      return next
                    })
                  }
                >
                  Clear filters
                </Button>
              ) : null}
            </div>
          ) : (
            list.map((p) => <ProductCard key={p.id} product={p} />)
          )}
        </div>
      </div>
    </div>
  )
}
