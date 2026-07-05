import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useSearchParams } from 'react-router-dom'
import { ProductCard } from '@/components/ProductCard'
import { IconFilterPeek } from '@/components/shop/IconFilterPeek'
import { PriceFilterSection } from '@/components/shop/PriceFilterSection'
import { SizeFilterDropdown } from '@/components/shop/SizeFilterDropdown'
import { ShopSortPicker } from '@/components/shop/ShopSortPicker'
import { ProductGridSkeleton } from '@/components/shop/ProductGridSkeleton'
import { shopToolbarButtonClass, shopToolbarLabelClass } from '@/components/shop/shopToolbar'
import { Button } from '@/components/ui/Button'

import { getProducts } from '@/api/product'
import { getCategories } from '@/api/category'
import type { Product } from "@/types";
import { mapProduct } from "@/mappers/productMapper";
import type { CategoryDto } from '@/types/api/CategoryDto'
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
): string | "all" {
  if (!c || c === "all") return "all";
  return allowedSlugs.has(c) ? c : "all";
}


export function ShopPage() {
  useDocumentTitle('Shop')
  const [searchParams, setSearchParams] = useSearchParams()
const [products, setProducts] =
  useState<Product[]>([]);

const [categories, setCategories] =
  useState<CategoryDto[]>([])

const [loading, setLoading] =
  useState(true)
  const allowedSlugs = useMemo(
  () =>
    new Set(
      categories.map((c) => {
        switch (c.name.toLowerCase()) {
          case "t-shirts":
            return "regular-tee";

          case "shorts":
            return "shorts";

          default:
            return c.name.toLowerCase();
        }
      })
    ),
  [categories]
);

  const q = searchParams.get('q') ?? ''
  const category = validCategory(searchParams.get('category'), allowedSlugs);
  const categoryHeading =
  category === "all"
    ? "All Products"
    : category;
  const sort = parseSort(searchParams.get('sort'))
  const minP = searchParams.get('min')
  const maxP = searchParams.get('max')
  const sizesRaw = searchParams.get('sizes') ?? ''
  const sizesParam = useMemo(
    () => sizesRaw.split(',').filter(Boolean),
    [sizesRaw],
  )

const priceBounds = useMemo(() => {
  if (!products.length) {
    return {
      max: 2000,
    };
  }

  const maxPrice = Math.max(
    ...products.map((p) => p.price)
  );

  return {
    max: Math.max(
      500,
      Math.ceil(maxPrice / 100) * 100
    ),
  };
}, [products]);

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

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortMenuOpen, setSortMenuOpen] = useState(false)

  async function loadData() {
  try {
    setLoading(true);

    const [productResponse, categoryResponse] =
      await Promise.all([
        getProducts(),
        getCategories(),
      ]);
    setProducts(
  productResponse.map(mapProduct)
);

    setCategories(categoryResponse);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
}

useEffect(() => {
  loadData();
}, []);

  const showProductLoading =
  loading;

const list = useMemo(() => {
  let filtered = [...products];

  // Search
  if (q.trim()) {
    const keyword = q.toLowerCase();

    filtered = filtered.filter((p) =>
      p.name.toLowerCase().includes(keyword)
    );
  }

  // Category
  if (category !== "all") {
    filtered = filtered.filter(
      (p) => p.categorySlug === category
    );
  }

  // Price
  if (apiMinPrice != null) {
    filtered = filtered.filter(
      (p) => p.price >= apiMinPrice
    );
  }

  if (apiMaxPrice != null) {
    filtered = filtered.filter(
      (p) => p.price <= apiMaxPrice
    );
  }

  // Size (temporary)
  if (sizesParam.length) {
    filtered = filtered.filter((p) =>
      p.sizes.some((s) =>
        sizesParam.includes(s)
      )
    );
  }

  // Sorting
  switch (sort) {
    case "price-asc":
      filtered.sort((a, b) => a.price - b.price);
      break;

    case "price-desc":
      filtered.sort((a, b) => b.price - a.price);
      break;

    case "new-arrival":
      filtered.sort((a, b) =>
        Number(b.isNew) - Number(a.isNew)
      );
      break;

    case "bestseller":
      filtered.sort(
        (a, b) => b.reviewCount - a.reviewCount
      );
      break;

    default:
      filtered.sort(
        (a, b) => b.popularity - a.popularity
      );
  }

  return filtered;
}, [
  products,
  q,
  category,
  sort,
  apiMinPrice,
  apiMaxPrice,
  sizesParam,
]);

  const setSort = useCallback(
    (key: SortKey) => {
      setSearchParams((prev) => {
        const n = new URLSearchParams(prev)
        if (key === 'popular') n.delete('sort')
        else n.set('sort', key)
        return n
      })
    },
    [setSearchParams],
  )

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
              setSearchParams((prev) => {
                const n = new URLSearchParams(prev)
                if (sizes.length) n.set('sizes', sizes.join(','))
                else n.delete('sizes')
                return n
              })
            }}
          />
          <PriceFilterSection
            boundMin={boundMin}
            boundMax={boundMax}
            minUrl={minFromUrl}
            maxUrl={maxFromUrl}
            onCommit={(min, max) => {
              setSearchParams((prev) => {
                const n = new URLSearchParams(prev)
                if (min == null) n.delete('min')
                else n.set('min', String(min))
                if (max == null) n.delete('max')
                else n.set('max', String(max))
                return n
              })
            }}
          />
          <div className="pt-2 pb-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full dark:!border-zinc-600 dark:!text-zinc-200"
              onClick={() => {
                setSearchParams((prev) => {
                  const n = new URLSearchParams(prev)
                  n.delete('min')
                  n.delete('max')
                  n.delete('sizes')
                  return n
                })
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
                  : 'No products found for the selected filters.'}
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
