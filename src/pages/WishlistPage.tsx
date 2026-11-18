import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getWishlistPage, isWishlistUnavailable, readWishlistApiError } from '@/api/wishlist'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastProvider'
import { useWishlist } from '@/context/WishlistProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { formatInr } from '@/lib/format'
import type { WishlistItemDto, WishlistPaginationDto } from '@/types/api/WishlistDto'

/**
 * Saved items — now backed by `/v1/wishlist/`.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THIS PAGE FETCHES INSTEAD OF READING THE PROVIDER
 * ──────────────────────────────────────────────────────────────────────────────
 * `WishlistProvider` holds product IDS, not product records — that is all a heart on a
 * shop card needs, and holding full records for every saved product just to answer
 * "is this one saved?" would be wasteful and would go stale.
 *
 * This page needs the records, and they are paginated, so it reads them itself. It still
 * writes THROUGH the provider: removing an item here updates the ids, so the navbar badge
 * and every heart elsewhere follow in the same render.
 *
 * The backend leaves inactive and deleted products out of the response, so a saved
 * product that has since been unpublished simply stops appearing — nothing here has to
 * filter for that.
 */

const PAGE_SIZE = 20

function IconHeart({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
        d="M12 20.25s-7.5-4.6-9.75-9.1C.75 7.6 2.6 4.5 6 4.5c2 0 3.5 1 6 3.3 2.5-2.3 4-3.3 6-3.3 3.4 0 5.25 3.1 3.75 6.65-2.25 4.5-9.75 9.1-9.75 9.1z"
      />
    </svg>
  )
}

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12h16m0 0-6-6m6 6-6 6" />
    </svg>
  )
}

export function WishlistPage() {
  useDocumentTitle('Wishlist')

  const { showToast } = useToast()
  const { remove, refresh } = useWishlist()

  const [items, setItems] = useState<WishlistItemDto[]>([])
  const [pagination, setPagination] = useState<WishlistPaginationDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<number | null>(null)

  /** Newest request wins, so a slow page 2 cannot land after a removal re-read page 1. */
  const requestId = useRef(0)
  const pageRef = useRef(1)

  const load = useCallback(async (targetPage: number, mode: 'replace' | 'append') => {
    const current = ++requestId.current

    if (mode === 'replace') {
      setLoading(true)
      setError(null)
    } else {
      setLoadingMore(true)
    }

    try {
      const result = await getWishlistPage({ page: targetPage, pageSize: PAGE_SIZE })
      if (current !== requestId.current) return

      setItems((previous) => {
        if (mode === 'replace') return result.items
        const seen = new Set(previous.map((item) => item.id))
        return [...previous, ...result.items.filter((item) => !seen.has(item.id))]
      })
      setPagination(result.pagination)
      pageRef.current = targetPage
    } catch (loadError) {
      if (current !== requestId.current) return

      /*
       * A missing endpoint is a deployment gap, not something the shopper did — and not
       * something a Try Again button can fix. It degrades to the empty state instead,
       * which is also what the header badge already shows, so the page and the chrome
       * agree instead of one claiming an error while the other says zero.
       *
       * The warning goes to the console, where it is aimed: at whoever is wondering why
       * the wishlist is empty on a build that has the feature.
       */
      if (isWishlistUnavailable(loadError)) {
        console.warn(
          '[panchvastra] GET /v1/wishlist/ returned 404 — the wishlist endpoint is not available on this backend. Showing the empty state.',
        )
        setItems([])
        setError(null)
        return
      }

      setError(readWishlistApiError(loadError, 'Unable to load your wishlist right now.'))
      if (mode === 'replace') setItems([])
    } finally {
      if (current === requestId.current) {
        setLoading(false)
        setLoadingMore(false)
      }
    }
  }, [])

  useEffect(() => {
    void load(1, 'replace')
  }, [load])

  /**
   * Removal is optimistic locally AND goes through the provider, which owns its own
   * optimistic update and rollback for the id set. On failure the card is put back where
   * it was so the list matches the hearts everywhere else.
   */
  const handleRemove = async (item: WishlistItemDto) => {
    setRemovingId(item.id)

    const snapshot = items
    setItems((previous) => previous.filter((entry) => entry.id !== item.id))

    const result = await remove(item.id)
    setRemovingId(null)

    if (result.ok) {
      setPagination((previous) =>
        previous ? { ...previous, total_records: Math.max(0, previous.total_records - 1) } : previous,
      )
      showToast('Removed from wishlist')
      return
    }

    setItems(snapshot)
    showToast('Could not remove', {
      variant: 'warning',
      description: result.reason === 'error' ? result.message : 'Please sign in and try again.',
    })
  }

  const total = pagination?.total_records ?? items.length
  const hasNext = pagination?.has_next === true

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="type-page-title">Wishlist</h1>
        {/* Skeletons keep the page's height stable while the first read lands. */}
        <ul className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5" aria-busy>
          {Array.from({ length: 10 }, (_, index) => (
            <li key={index} className="border border-zinc-200 bg-white">
              <div className="aspect-[4/5] w-full bg-soft-beige" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-full rounded-sm bg-soft-beige" />
                <div className="h-3 w-1/2 rounded-sm bg-soft-beige" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="type-page-title">Wishlist</h1>

      {items.length > 0 ? (
        <p className="mt-1 text-sm text-zinc-500">
          {total} saved {total === 1 ? 'item' : 'items'}
        </p>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-lg border border-zinc-200 bg-soft-beige p-5 text-center" role="alert">
          <p className="font-sans text-sm text-zinc-700">{error}</p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => {
              void load(1, 'replace')
              void refresh()
            }}
          >
            Try Again
          </Button>
        </div>
      ) : null}

      {items.length === 0 && !error ? (
        /*
         * `min-h` rather than a full-viewport height: it balances the empty state between
         * the navbar and the footer while leaving the footer in normal page flow.
         */
        <div className="flex min-h-[48vh] flex-col items-center justify-center px-4 py-12 text-center">
          <IconHeart className="size-11 text-zinc-900" />

          <h2 className="mt-5 text-2xl font-bold tracking-tight text-black sm:text-3xl">Your wishlist is empty</h2>

          <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">
            Found something you like? Hit the heart and keep it here.
          </p>

          <Link
            to="/shop"
            className="mt-7 inline-flex items-center justify-center gap-2 bg-chocolate px-7 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-espresso"
          >
            Explore the collection
            <IconArrowRight className="size-4" />
          </Link>
        </div>
      ) : null}

      {items.length > 0 ? (
        <>
          <ul
            aria-label="Saved items"
            className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
          >
            {items.map((item) => {
              const off = Math.round(item.discount_percentage ?? 0)
              const hasDiscount = off > 0 && item.mrp > item.selling_price

              return (
                <li key={item.id} className="flex flex-col border border-zinc-200 bg-white">
                  <div className="relative">
                    <Link to={`/product/${item.id}`} className="block" aria-label={item.name}>
                      <div className="aspect-[4/5] overflow-hidden bg-soft-beige">
                        <img
                          src={item.primary_image?.trim() || '/images/no-image.png'}
                          alt={item.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    </Link>

                    {hasDiscount ? (
                      <span className="absolute left-2 top-2 bg-burgundy px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cream">
                        {off}% off
                      </span>
                    ) : null}

                    {/*
                      Filled heart — everything here is already saved, so pressing it
                      removes. It goes through the shared provider, so the navbar badge and
                      every other heart on the site follow.
                    */}
                    <button
                      type="button"
                      onClick={() => void handleRemove(item)}
                      disabled={removingId === item.id}
                      aria-label={`Remove ${item.name} from wishlist`}
                      className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full border border-zinc-200 bg-cream text-burgundy shadow-sm transition-colors hover:border-burgundy disabled:opacity-50"
                    >
                      <IconHeart className="size-4" filled />
                    </button>
                  </div>

                  {/* `min-w-0` lets the text block shrink inside the flex column so a long
                      unbroken word truncates instead of widening the card. */}
                  <div className="flex min-w-0 flex-1 flex-col p-3">
                    <Link
                      to={`/product/${item.id}`}
                      className="line-clamp-2 break-words text-xs font-semibold text-zinc-900 transition-colors hover:text-black"
                    >
                      {item.name}
                    </Link>

                    {item.color ? <p className="mt-0.5 text-[11px] text-zinc-500">{item.color}</p> : null}

                    <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                      <span className="text-sm font-bold text-black">{formatInr(item.selling_price)}</span>
                      {hasDiscount ? (
                        <span className="text-xs text-zinc-400 line-through">{formatInr(item.mrp)}</span>
                      ) : null}
                    </div>

                    {/*
                      `mt-auto` pins this to the bottom so the button lines up across a row
                      whatever the title length — grid stretches every card to the tallest.

                      The cart API takes a variant SIZE id, and a saved item carries no
                      size — so this opens the product's own size picker rather than
                      guessing one, keeping stock and size validation intact.
                    */}
                    <div className="mt-auto pt-3">
                      <Link
                        to={`/product/${item.id}`}
                        aria-label={`Add ${item.name} to cart — choose a size`}
                        className="flex min-h-[38px] w-full items-center justify-center bg-chocolate px-2 text-center text-[11px] font-bold uppercase leading-tight tracking-[0.08em] text-cream transition-colors hover:bg-espresso"
                      >
                        Add to cart
                      </Link>
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>

          {hasNext ? (
            <div className="mt-8 flex justify-center">
              <Button
                type="button"
                variant="outline"
                disabled={loadingMore}
                onClick={() => void load(pageRef.current + 1, 'append')}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
