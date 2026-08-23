import { useCallback, useEffect, useMemo, useState } from 'react'
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

import { getProducts } from '@/api/product'
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

export function ShopPage() {
  useDocumentTitle('Shop')
  const [searchParams, setSearchParams] = useSearchParams()

  const [categories, setCategories] = useState<CategoryDto[]>([])
  /** Full unfiltered catalog — fetched once, reused as the "no filters active" product list and as the source for deriving Sub Category options (so those options don't shrink/flicker as Size/Search change). */
  const [catalogSnapshot, setCatalogSnapshot] = useState<Product[]>([])
  const [catalogReady, setCatalogReady] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  const [products, setProducts] = useState<Product[]>([])
  const [filterLoading, setFilterLoading] = useState(false)

  const [sortMenuOpen, setSortMenuOpen] = useState(false)

  useEffect(() => {
    let active = true
    setInitialLoading(true)

    Promise.all([getProducts(), getCategories()])
      .then(([dtos, categoryList]) => {
        if (!active) return
        const mapped = dtos.map(mapProduct)
        setCatalogSnapshot(mapped)
        setProducts(mapped)
        setCategories(categoryList)
      })
      .finally(() => {
        if (active) {
          setInitialLoading(false)
          setCatalogReady(true)
        }
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

  const categoryHeading =
    category === 'all' ? 'All Products' : (categories.find((c) => categoryNameToSlug(c.name) === category)?.name ?? 'All Products')

  // Sub Category options depend only on the selected Category, derived from the full catalog snapshot
  // (not the currently-filtered `products`) so they stay stable while Size/Search change.
  const subCategoryOptions: SubCategoryOption[] = useMemo(() => {
    const scoped = category === 'all' ? catalogSnapshot : catalogSnapshot.filter((p) => p.categorySlug === category)
    const bySlug = new Map<string, SubCategoryOption>()
    for (const p of scoped) {
      if (p.subCategorySlug && p.subCategoryName && p.subCategoryId != null && !bySlug.has(p.subCategorySlug)) {
        bySlug.set(p.subCategorySlug, { slug: p.subCategorySlug, name: p.subCategoryName, id: p.subCategoryId })
      }
    }
    return [...bySlug.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [catalogSnapshot, category])

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

  // Real server-side filtering for category/subcategory/size/search (verified against the live backend).
  // Reuses the initial catalog snapshot when no server-filterable param is active, avoiding a duplicate request.
  useEffect(() => {
    if (!catalogReady) return
    let cancelled = false

    const categoryId = category !== 'all' ? categories.find((c) => categoryNameToSlug(c.name) === category)?.id : undefined
    const subCategoryId = subcategory !== 'all' ? subCategoryOptions.find((s) => s.slug === subcategory)?.id : undefined
    const sizeParam = size !== 'all' ? size : undefined
    const searchParam = q.trim() || undefined

    const hasServerFilter = categoryId != null || subCategoryId != null || sizeParam != null || searchParam != null

    if (!hasServerFilter) {
      setProducts(catalogSnapshot)
      return
    }

    setFilterLoading(true)
    getProducts({
      category_id: categoryId,
      sub_category_id: subCategoryId,
      size: sizeParam,
      search: searchParam,
    })
      .then((dtos) => {
        if (cancelled) return
        setProducts(dtos.map(mapProduct))
      })
      .finally(() => {
        if (!cancelled) setFilterLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [catalogReady, category, subcategory, size, q, categories, catalogSnapshot, subCategoryOptions])

  const priceRange = priceRangeFromBucket(priceBucket)

  const list = useMemo(() => {
    let filtered = [...products]

    if (priceRange.min != null) filtered = filtered.filter((p) => p.price >= priceRange.min!)
    if (priceRange.max != null) filtered = filtered.filter((p) => p.price <= priceRange.max!)

    switch (sort) {
      case 'price-asc':
        filtered.sort((a, b) => a.price - b.price)
        break
      case 'price-desc':
        filtered.sort((a, b) => b.price - a.price)
        break
      case 'new-arrival':
        filtered.sort((a, b) => Number(b.isNew) - Number(a.isNew))
        break
      case 'bestseller':
        filtered.sort((a, b) => b.reviewCount - a.reviewCount)
        break
      default:
        filtered.sort((a, b) => b.popularity - a.popularity)
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

  const showProductLoading = initialLoading || filterLoading

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="type-page-title">{categoryHeading}</h1>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
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

        <ShopSortPicker
          sort={sort}
          open={sortMenuOpen}
          onOpenChange={setSortMenuOpen}
          onSelect={setSort}
        />
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {showProductLoading ? (
          <ProductGridSkeleton count={8} />
        ) : list.length === 0 ? (
          <div className="col-span-full border border-zinc-200 bg-zinc-50 px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-950/50">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">No products to show.</p>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {hasActiveFilters
                ? 'Try resetting filters — size, price range, search, category, or subcategory can hide everything.'
                : 'No products found.'}
            </p>
            {hasActiveFilters ? (
              <Button type="button" className="mt-6" onClick={resetAllFilters}>
                Reset Filter
              </Button>
            ) : null}
          </div>
        ) : (
          list.map((p) => <ProductCard key={p.id} product={p} variant="homepage" />)
        )}
      </div>
    </div>
  )
}
