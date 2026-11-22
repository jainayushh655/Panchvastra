'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { ProductCard } from '@/components/ProductCard'
import { ProductGridSkeleton } from '@/components/shop/ProductGridSkeleton'
import { ShopFilterBar } from '@/components/shop/ShopFilterBar'
import { ShopSortPicker } from '@/components/shop/ShopSortPicker'
import { Button } from '@/components/ui/Button'
import { mapProduct } from '@/mappers/productMapper'
import {
  SHOP_PAGE_SIZE,
  applyClientRefinements,
  categoryHeadingFor,
  priceRangeFromBucket,
  resolveShopSelection,
  type SubCategoryOption,
} from '@/lib/shopQuery'
import { getProductsPageList, readProductApiError } from '@/services/products'
import type { CategoryDto } from '@/types/api/CategoryDto'
import type { Product } from '@/types'
import type { SortKey } from '@/types'

/**
 * The Shop page's interactive half.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT THE SERVER DOES AND WHAT THIS DOES
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite `ShopPage` owns everything: it mounts empty, fetches the categories, the whole
 * catalogue (for the Sub Category options) and page 1, and paints skeletons until they
 * land. None of its products are in the HTML.
 *
 * Here the server has already done all of that — page 1 of the CURRENT query is rendered
 * into the markup, so `/shop?category=hoodie` is a crawlable page of real products. This
 * component owns only what a server cannot:
 *
 *   - writing the filter controls back to the URL,
 *   - appending page 2 onward as the shopper scrolls,
 *   - the price band and the two sorts the backend cannot do.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS NO "RESET THE GRID" EFFECT
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite page needs `requestIdRef`, `inFlightRef`, a reset effect keyed on
 * `serverQueryKey` and a "newest request wins" guard, because a slow page-2 response can
 * arrive after the shopper has changed a filter and mix two different queries into one
 * grid.
 *
 * None of that is here, because the page renders this component with
 * `key={selection.serverKey}`. A query change is a REMOUNT: the appended pages, the
 * paging cursor and any in-flight bookkeeping go with the old instance, and the new one
 * starts from the server's page 1. The race cannot be lost because the losing state no
 * longer exists. The one guard that remains, `inFlightRef`, stops two scroll events from
 * requesting the same page twice — which is a real thing that happens within one query.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHICH CHANGES GO TO THE SERVER
 * ──────────────────────────────────────────────────────────────────────────────
 * Exactly the ones that change the backend request. `resolveShopSelection` turns a URL
 * into the query the API is asked for, and `serverKey` is that query as a string:
 *
 *   - different key (category, sub-category, size, search, a server sort) -> `router.push`,
 *     so the server fetches page 1 of the new query and the grid remounts;
 *   - same key (the price band, or switching between the two client-only sorts) ->
 *     `history.pushState`, which updates the address bar and nothing else.
 *
 * That second branch is what keeps the Vite behaviour of NOT throwing away loaded pages
 * when only a client-side refinement changed — a shopper three pages deep who narrows the
 * price band keeps all three pages — and it means no request is made for data the browser
 * already has.
 */

/** Appends a page, dropping any id already present so an overlapping page cannot duplicate a card. */
function appendUnique(previous: Product[], incoming: Product[]): Product[] {
  const seen = new Set(previous.map((p) => p.id))
  return [...previous, ...incoming.filter((p) => !seen.has(p.id))]
}

/**
 * A hanging garment tag, for the "coming soon" state.
 *
 * Drawn in the same thin-stroke, monochrome language as the other icons on the storefront
 * rather than being a stock illustration, so it carries no colour of its own and inherits
 * the page's text colour in both themes.
 */
function IconComingSoon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth={1.6}
        strokeLinejoin="round"
        d="M26.5 6.5h9a6 6 0 0 1 6 6v9a3 3 0 0 1-.88 2.12L24.6 39.65a3 3 0 0 1-4.24 0L8.35 27.64a3 3 0 0 1 0-4.24L24.38 7.38a3 3 0 0 1 2.12-.88z"
      />
      <circle cx="33.5" cy="14.5" r="2.6" strokeWidth={1.6} />
    </svg>
  )
}

export function ShopBrowser({
  categories,
  subCategoryOptions,
  initialProducts,
  initialHasNext,
  initialError,
  serverKey,
}: {
  categories: CategoryDto[]
  /** Options for the CURRENTLY selected category, derived on the server from the full catalogue. */
  subCategoryOptions: SubCategoryOption[]
  /** Page 1 of the current query, already mapped. */
  initialProducts: Product[]
  initialHasNext: boolean
  /** The backend's own message when page 1 failed, else null. */
  initialError: string | null
  /** The server's resolution of this URL. This component is keyed on it. */
  serverKey: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const selection = useMemo(
    () => resolveShopSelection((key) => searchParams.get(key), categories, subCategoryOptions),
    [searchParams, categories, subCategoryOptions],
  )

  /** Pages 2+ only. Page 1 comes from the server and never lives in state. */
  const [appended, setAppended] = useState<Product[]>([])
  const [hasNext, setHasNext] = useState(initialHasNext)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(initialError)

  /** Synchronous guard so scrolling cannot fire two "load next page" requests at once. */
  const inFlightRef = useRef(false)
  /** The highest page actually loaded for this query. */
  const pageRef = useRef(1)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  const products = useMemo(
    () => (appended.length ? appendUnique(initialProducts, appended) : initialProducts),
    [initialProducts, appended],
  )

  /**
   * Clears a `?subcategory=` that does not belong to the current category's options.
   *
   * The Vite page does this with `setSearchParams(..., { replace: true })` once its
   * catalogue has loaded. Here the options are known before the first paint, so the check
   * is immediate — and it is a `replaceState`, not a navigation, because dropping a
   * parameter the server already ignored cannot change what the server returns.
   */
  useEffect(() => {
    const current = searchParams.get('subcategory')
    if (!current || current === 'all') return
    if (subCategoryOptions.some((s) => s.slug === current)) return

    const next = new URLSearchParams(searchParams.toString())
    next.delete('subcategory')
    const query = next.toString()
    window.history.replaceState(null, '', query ? `/shop?${query}` : '/shop')
  }, [searchParams, subCategoryOptions])

  /**
   * Writes the filter controls back to the URL.
   *
   * See the header: a change that alters the backend query navigates, and one that does
   * not only rewrites the address bar.
   */
  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString())
      mutate(next)

      const nextSelection = resolveShopSelection((key) => next.get(key), categories, subCategoryOptions)
      const query = next.toString()
      const url = query ? `/shop?${query}` : '/shop'

      if (nextSelection.serverKey === serverKey) {
        // Same backend query: the browser already holds every product this can show.
        window.history.pushState(null, '', url)
        return
      }

      // `startTransition` keeps the current grid on screen while the server renders the
      // new one, and drives the skeleton below through `isPending`.
      startTransition(() => router.push(url))
    },
    [categories, router, searchParams, serverKey, subCategoryOptions],
  )

  const loadMore = useCallback(() => {
    if (!hasNext || inFlightRef.current) return

    inFlightRef.current = true
    setLoadingMore(true)

    const targetPage = pageRef.current + 1

    void getProductsPageList({ ...selection.serverParams, page: targetPage, page_size: SHOP_PAGE_SIZE })
      .then(({ products: dtos, pagination }) => {
        const mapped = dtos.map(mapProduct)
        setAppended((previous) => appendUnique(previous, mapped))
        // Paging follows the response's own `has_next`; nothing is inferred from counts,
        // so a backend that stops reporting it simply stops the infinite scroll.
        setHasNext(pagination?.has_next === true && mapped.length > 0)
        setLoadError(null)
        pageRef.current = targetPage
      })
      .catch((error: unknown) => {
        // Keep what is already on screen and stop auto-loading, so a failing request
        // cannot be retried forever by the scroll observer.
        setLoadError(readProductApiError(error, 'Unable to load products.'))
        setHasNext(false)
      })
      .finally(() => {
        inFlightRef.current = false
        setLoadingMore(false)
      })
  }, [hasNext, selection.serverParams])

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

  const list = useMemo(
    () => applyClientRefinements(products, selection.priceBucket, selection.sort),
    [products, selection.priceBucket, selection.sort],
  )

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

  const categoryHeading = categoryHeadingFor(categories, selection.category)

  /** "Nothing matched" is only true once there is nothing left to load. */
  const showEmptyState = !isPending && list.length === 0 && !hasNext && !loadError

  /**
   * An empty result because the CATEGORY itself is empty, rather than because a filter
   * narrowed everything away.
   *
   * The difference matters: "no product for this choice" invites you to loosen a filter,
   * which is useless advice when there is no filter to loosen and the category simply has
   * not been stocked yet. So this is true only when a category is selected and nothing
   * else — no search, no subcategory, no size, no price band — is narrowing the list.
   * Sort is excluded deliberately: reordering an empty list cannot make it non-empty.
   */
  const categoryNotStockedYet =
    showEmptyState &&
    selection.category !== 'all' &&
    !selection.q.trim() &&
    selection.subcategory === 'all' &&
    selection.size === 'all' &&
    selection.priceBucket === 'all'

  return (
    <>
      {/*
        The heading is rendered by the SERVER as an `h1` above this component, so it is in
        the HTML for a crawler. This copy is the one the empty state shows, and it tracks
        the live selection.
      */}
      {/* `items-start` so the Sort control lines up with the filter selects: the filter
          bar carries its own `pb-6` + bottom rule, so centring the row pushed Sort ~12px
          below the others. */}
      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <ShopFilterBar
          categories={categories}
          category={selection.category}
          onCategoryChange={(slug) =>
            updateParams((n) => (slug === 'all' ? n.delete('category') : n.set('category', slug)))
          }
          subCategoryOptions={subCategoryOptions}
          subCategory={selection.subcategory}
          onSubCategoryChange={(slug) =>
            updateParams((n) => (slug === 'all' ? n.delete('subcategory') : n.set('subcategory', slug)))
          }
          subCategoryDisabled={subCategoryOptions.length === 0}
          size={selection.size}
          onSizeChange={(s) => updateParams((n) => (s === 'all' ? n.delete('size') : n.set('size', s)))}
          priceBucket={selection.priceBucket}
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

        <ShopSortPicker sort={selection.sort} onSelect={setSort} />
      </div>

      {/* Extra top margin now that the toolbar has no bottom rule: the separation between
          filters and products is carried by whitespace instead of a line. */}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {isPending ? (
          // The only loading state left: the server is rendering a different query. Page 1
          // of the CURRENT query was already in the HTML, so the page never opens on this.
          <ProductGridSkeleton count={8} />
        ) : categoryNotStockedYet ? (
          <div className="col-span-full flex flex-col items-center px-4 py-14 text-center sm:py-20">
            <IconComingSoon className="size-12 text-black dark:text-white" />

            <p className="mt-6 font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              {categoryHeading}
            </p>
            <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-black sm:text-4xl dark:text-white">
              Coming Soon
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              We&rsquo;re putting this collection together. It&rsquo;ll land here first.
            </p>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
              <Button type="button" onClick={resetAllFilters}>
                Browse everything
              </Button>
              <Link
                href="/custom-piece"
                className="inline-flex min-h-[42px] items-center justify-center border border-chocolate px-6 text-xs font-bold uppercase tracking-[0.14em] text-espresso transition-colors hover:bg-chocolate hover:text-cream dark:border-white dark:text-white dark:hover:bg-white dark:hover:text-black"
              >
                Design your own
              </Link>
            </div>
          </div>
        ) : showEmptyState ? (
          <div className="col-span-full px-4 py-12 text-center">
            <p className="font-medium text-zinc-900 dark:text-zinc-100">No product for this choice.</p>
            {selection.hasActiveFilters ? (
              <Button type="button" className="mt-5" onClick={resetAllFilters}>
                Reset Filter
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            {list.map((p) => (
              <ProductCard key={p.id} product={p} variant="homepage" />
            ))}
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
      {!isPending && hasNext ? (
        <div ref={sentinelRef} className="mt-10 flex justify-center">
          <Button type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load More Products'}
          </Button>
        </div>
      ) : null}

      {loadError ? (
        <div className="mt-8 border border-zinc-200 bg-soft-beige p-6 text-center" role="alert">
          <p className="text-sm text-zinc-700">{loadError}</p>
          {/*
            Two different retries, because there are two different failures. A failed
            APPEND is retried in the browser, from the page it stopped on. A failed page 1
            happened on the server, so the retry is `router.refresh()` — it re-runs the
            server render rather than fetching a page the browser has no state for.
          */}
          <Button
            type="button"
            className="mt-4"
            onClick={() => {
              setLoadError(null)
              if (initialError) startTransition(() => router.refresh())
              else loadMore()
            }}
          >
            Try Again
          </Button>
        </div>
      ) : null}

      {/* Announces each batch to assistive tech, which otherwise gets no signal that the
          page grew under the shopper. */}
      <p className="sr-only" role="status" aria-live="polite">
        {isPending ? 'Loading products' : `Showing ${list.length} products`}
      </p>
    </>
  )
}
