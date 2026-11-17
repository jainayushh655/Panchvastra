import { RatingStars } from '@/components/product/RatingStars'
import type { ProductRatingSummaryDto } from '@/types/api/ProductDetailDto'

/**
 * `★★★★½  4.8 (128 Reviews)   ✓ 96% Recommend`
 *
 * Hidden entirely when the product has no reviews. "0.0 (0 Reviews)" beside a brand-new
 * product reads as a bad score rather than as an absence, so the row simply is not there
 * — the reviews block further down carries the empty state instead.
 *
 * The count is a button, not a link: it scrolls to the reviews section on the same page.
 * A real `<button>` rather than an `<a href="#reviews">` because the target is revealed by
 * scrolling, and an anchor would also push a history entry the shopper then has to go back
 * through.
 */

type ProductRatingRowProps = {
  summary: ProductRatingSummaryDto | null | undefined
  onReviewsClick: () => void
}

export function ProductRatingRow({ summary, onReviewsClick }: ProductRatingRowProps) {
  const total = summary?.total_reviews ?? 0
  if (!summary || total <= 0) return null

  const average = Number.isFinite(summary.average_rating) ? summary.average_rating : 0
  const recommend = summary.recommend_percentage

  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
      <RatingStars rating={average} size="md" label={`Rated ${average.toFixed(1)} out of 5`} />

      <button
        type="button"
        onClick={onReviewsClick}
        className="font-sans text-sm text-zinc-600 underline-offset-4 transition-colors hover:text-black hover:underline"
      >
        {average.toFixed(1)} ({total.toLocaleString('en-IN')} {total === 1 ? 'Review' : 'Reviews'})
      </button>

      {/*
        Only shown when it is actually positive. A "12% Recommend" pill rendered in the
        same reassuring style as a 96% one would be actively misleading, and this is a
        trust badge rather than a statistic — the full distribution is in the reviews
        block for anyone who wants the real picture.
      */}
      {typeof recommend === 'number' && recommend >= 50 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sand bg-soft-beige px-3 py-1 font-sans text-xs font-semibold text-espresso">
          <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {Math.round(recommend)}% Recommend
        </span>
      ) : null}
    </div>
  )
}
