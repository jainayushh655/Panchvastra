import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'
import {
  EMPTY_REVIEW_SUMMARY,
  deleteReview,
  getProductReviews,
  readReviewApiError,
} from '@/api/productReviews'
import { ReviewCard } from '@/components/reviews/ReviewCard'
import { ReviewPhotoLightbox } from '@/components/reviews/ReviewPhotoLightbox'
import { ReviewSummaryPanel } from '@/components/reviews/ReviewSummaryPanel'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastProvider'
import {
  REVIEW_SORT_OPTIONS,
  type ReviewDto,
  type ReviewSortBy,
  type ReviewSummaryDto,
} from '@/types/api/ReviewDto'

/**
 * The Customer Reviews block on the product page.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THE SUMMARY IS RE-READ ON EVERY LOAD
 * ──────────────────────────────────────────────────────────────────────────────
 * The list endpoint recomputes `summary` for the CURRENT filter and returns it alongside
 * the page. So the summary that comes back with `with_photos=true` describes the photo
 * reviews, not all of them. Caching the first response's summary and reusing it across
 * tabs would show the all-reviews average above a photos-only list.
 *
 * The tab COUNTS are the exception and come from the all-reviews summary
 * (`total_reviews` and `with_photos_count`), which is why the counts stay stable while
 * switching tabs instead of one of them collapsing to the current filter's total.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * LAYOUT STABILITY
 * ──────────────────────────────────────────────────────────────────────────────
 * The section reserves its height while loading (`min-h`) rather than collapsing to
 * nothing and springing open when the request lands. Reviews sit below the fold on a page
 * that is still loading images above them, and a block that appears late is a block that
 * shoves the page under the reader's cursor.
 */

const PAGE_SIZE = 3

type ReviewsSectionProps = {
  productId: number
  /** Opens the edit form. The page owns the form so order flows can reuse it. */
  onEditReview: (review: ReviewDto) => void
  /** Bumped by the parent after a review is written or edited, to force a re-read. */
  refreshToken?: number
  /** Reports the all-reviews summary upward, so the page can keep its rating row in step. */
  onSummaryLoaded?: (summary: ReviewSummaryDto) => void
  /**
   * "Add Review". The page owns this because writing a review needs an `order_item_id`
   * from a delivered order, which has to be looked up — this component only renders the
   * control and reports the click.
   */
  onWriteReview?: () => void
  /** True while that lookup is in flight, so the button can say so. */
  writeReviewBusy?: boolean
}

type Tab = 'all' | 'photos'

export const ReviewsSection = forwardRef<HTMLElement, ReviewsSectionProps>(function ReviewsSection(
  { productId, onEditReview, refreshToken = 0, onSummaryLoaded, onWriteReview, writeReviewBusy = false },
  ref,
) {
  const { showToast } = useToast()

  const [tab, setTab] = useState<Tab>('all')
  const [sortBy, setSortBy] = useState<ReviewSortBy>('recent')

  const [reviews, setReviews] = useState<ReviewDto[]>([])
  const [summary, setSummary] = useState<ReviewSummaryDto>(EMPTY_REVIEW_SUMMARY)
  /** The ALL-reviews summary, kept so both tab counts stay correct on the photos tab. */
  const [baseSummary, setBaseSummary] = useState<ReviewSummaryDto | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasNext, setHasNext] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [lightbox, setLightbox] = useState<{ review: ReviewDto; index: number } | null>(null)

  /** Newest request wins — a slow page-2 append can never land after a tab change. */
  const requestId = useRef(0)
  const pageRef = useRef(1)

  const load = useCallback(
    async (targetPage: number, mode: 'replace' | 'append') => {
      const current = ++requestId.current

      if (mode === 'replace') {
        setLoading(true)
        setError(null)
      } else {
        setLoadingMore(true)
      }

      try {
        const result = await getProductReviews({
          product_id: productId,
          page: targetPage,
          page_size: PAGE_SIZE,
          sort_by: sortBy,
          with_photos: tab === 'photos',
        })

        if (current !== requestId.current) return

        const nextSummary = result.summary ?? EMPTY_REVIEW_SUMMARY
        setSummary(nextSummary)

        // Only the unfiltered read defines the tab counts and the page's rating row.
        if (tab === 'all') {
          setBaseSummary(nextSummary)
          onSummaryLoaded?.(nextSummary)
        }

        setReviews((previous) => {
          if (mode === 'replace') return result.reviews
          // Guard against an overlapping page repeating a review as its own card.
          const seen = new Set(previous.map((review) => review.id))
          return [...previous, ...result.reviews.filter((review) => !seen.has(review.id))]
        })

        setHasNext(result.pagination?.has_next === true)
        pageRef.current = targetPage
      } catch (requestError) {
        if (current !== requestId.current) return

        setError(readReviewApiError(requestError, 'Unable to load reviews right now.'))
        if (mode === 'replace') {
          setReviews([])
          setHasNext(false)
        } else {
          // Keep what is on screen and stop offering more, so a failing request cannot be
          // retried endlessly by repeated taps.
          setHasNext(false)
        }
      } finally {
        if (current === requestId.current) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [productId, sortBy, tab, onSummaryLoaded],
  )

  // Back to page one whenever the query changes — product, tab, sort, or an external
  // refresh after the shopper wrote or edited their own review.
  useEffect(() => {
    pageRef.current = 1
    void load(1, 'replace')
  }, [load, refreshToken])

  const handleDelete = async (review: ReviewDto) => {
    if (!window.confirm('Delete your review? This cannot be undone.')) return

    try {
      await deleteReview(review.id)
      showToast('Review deleted')
      pageRef.current = 1
      await load(1, 'replace')
    } catch (deleteError) {
      showToast('Could not delete review', {
        variant: 'warning',
        description: readReviewApiError(deleteError, 'Please try again.'),
      })
    }
  }

  const totalReviews = baseSummary?.total_reviews ?? summary.total_reviews
  const photoCount = baseSummary?.with_photos_count ?? summary.with_photos_count
  const isEmpty = !loading && reviews.length === 0 && totalReviews === 0

  return (
    <section ref={ref} aria-labelledby="reviews-heading" className="mt-12 scroll-mt-24 sm:mt-16">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="reviews-heading" className="font-display text-xl font-bold tracking-tight text-black sm:text-2xl">
          Customer Reviews{totalReviews > 0 ? ` (${totalReviews.toLocaleString('en-IN')})` : ''}
        </h2>

        {onWriteReview ? (
          <button
            type="button"
            onClick={onWriteReview}
            disabled={writeReviewBusy}
            className="type-btn inline-flex min-h-[40px] items-center gap-2 rounded-lg border-2 border-chocolate px-5 py-2 text-xs text-espresso transition-colors hover:bg-chocolate hover:text-cream disabled:opacity-60"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path
                d="M12 3.3l2.6 5.3 5.8.85-4.2 4.1 1 5.8-5.2-2.74L6.8 19.35l1-5.8-4.2-4.1 5.8-.85L12 3.3z"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            </svg>
            {writeReviewBusy ? 'Checking…' : 'Add Review'}
          </button>
        ) : null}
      </div>

      {/* Reserved height: the block keeps its footprint while the first page loads, so the
          related-products rail below it does not jump when reviews arrive. */}
      <div className="mt-6 min-h-[18rem]">
        {isEmpty ? (
          <div className="rounded-xl border border-zinc-200 bg-white px-6 py-12 text-center">
            <p className="font-sans text-sm font-semibold text-black">No reviews yet</p>
            <p className="type-body-sm mx-auto mt-2 max-w-sm">
              Reviews come from customers who have received this product. Be the first to
              share yours once your order is delivered.
            </p>

            {/* Repeated here because the heading's button sits far above an empty block,
                and this is the one place a first reviewer is actually looking. */}
            {onWriteReview ? (
              <Button type="button" className="mt-6" disabled={writeReviewBusy} onClick={onWriteReview}>
                {writeReviewBusy ? 'Checking…' : 'Add Review'}
              </Button>
            ) : null}
          </div>
        ) : (
          <>
            <ReviewSummaryPanel summary={summary} />

            <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-b border-zinc-200">
              {/*
                `role="tablist"` is deliberately NOT used: these two controls re-run a
                query rather than swapping pre-rendered panels, and claiming the tab
                pattern would promise keyboard behaviour (arrow-key navigation between
                tabs) that this does not implement. They are buttons that say what they
                are with `aria-pressed`.
              */}
              <div className="flex gap-6">
                <button
                  type="button"
                  aria-pressed={tab === 'all'}
                  onClick={() => setTab('all')}
                  className={`-mb-px border-b-2 pb-2.5 font-sans text-sm font-semibold transition-colors ${
                    tab === 'all' ? 'border-burgundy text-black' : 'border-transparent text-zinc-500 hover:text-black'
                  }`}
                >
                  All Reviews ({totalReviews.toLocaleString('en-IN')})
                </button>

                <button
                  type="button"
                  aria-pressed={tab === 'photos'}
                  onClick={() => setTab('photos')}
                  disabled={photoCount === 0}
                  className={`-mb-px border-b-2 pb-2.5 font-sans text-sm font-semibold transition-colors disabled:opacity-40 ${
                    tab === 'photos' ? 'border-burgundy text-black' : 'border-transparent text-zinc-500 hover:text-black'
                  }`}
                >
                  With Photos ({photoCount.toLocaleString('en-IN')})
                </button>
              </div>

              <label className="flex items-center gap-2 pb-2 font-sans text-xs text-zinc-500">
                Sort by:
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as ReviewSortBy)}
                  className="border-0 bg-transparent font-sans text-xs font-semibold text-black focus:outline-none focus-visible:ring-2 focus-visible:ring-chocolate"
                >
                  {REVIEW_SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {loading ? (
              <ul className="divide-y divide-zinc-200" aria-busy>
                {[0, 1, 2].map((row) => (
                  <li key={row} className="flex gap-4 py-6">
                    <span className="size-9 shrink-0 rounded-full bg-soft-beige" />
                    <div className="flex-1 space-y-2.5">
                      <span className="block h-3 w-36 rounded-sm bg-soft-beige" />
                      <span className="block h-3 w-24 rounded-sm bg-soft-beige" />
                      <span className="block h-3 w-full max-w-md rounded-sm bg-soft-beige" />
                    </div>
                  </li>
                ))}
                <li className="sr-only">Loading reviews</li>
              </ul>
            ) : reviews.length === 0 ? (
              <p className="py-10 text-center font-sans text-sm text-zinc-500">
                {tab === 'photos' ? 'No reviews with photos yet.' : 'No reviews matched.'}
              </p>
            ) : (
              <div>
                {reviews.map((review) => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    onPhotoClick={(target, index) => setLightbox({ review: target, index })}
                    onEdit={onEditReview}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}

            {error ? (
              <div className="mt-4 rounded-lg border border-zinc-200 bg-soft-beige p-4 text-center" role="alert">
                <p className="font-sans text-sm text-zinc-700">{error}</p>
                <Button type="button" size="sm" className="mt-3" onClick={() => void load(pageRef.current, 'replace')}>
                  Try Again
                </Button>
              </div>
            ) : null}

            {!loading && hasNext ? (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => void load(pageRef.current + 1, 'append')}
                  className="type-btn inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg border border-zinc-300 px-7 py-2.5 text-xs text-espresso transition-colors hover:border-chocolate disabled:opacity-60"
                >
                  {loadingMore
                    ? 'Loading…'
                    : `View all ${(tab === 'photos' ? photoCount : totalReviews).toLocaleString('en-IN')} reviews`}
                  <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                    <path d="m6 9 6 6 6-6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {lightbox ? (
        <ReviewPhotoLightbox
          images={lightbox.review.images}
          index={lightbox.index}
          reviewerName={lightbox.review.reviewer_name}
          onIndexChange={(index) => setLightbox((current) => (current ? { ...current, index } : current))}
          onClose={() => setLightbox(null)}
        />
      ) : null}
    </section>
  )
})
