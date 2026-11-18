import { RatingStars } from '@/components/product/RatingStars'
import type { ReviewSummaryDto } from '@/types/api/ReviewDto'

/**
 * The left-hand block of the reviews section: the big average, and the 5★→1★ bars.
 *
 * Every number here is computed by the backend — the average, the percentages and the
 * recommend figure. Deriving any of them from the loaded page would be wrong by
 * construction, because a page holds three reviews out of a hundred and twenty-eight.
 *
 * The bars are rendered 5 down to 1 regardless of what order the API sends the buckets in,
 * and a rating with no reviews still gets its row at zero width. A distribution that
 * silently skipped empty ratings would make the rows shift position between products.
 */

type ReviewSummaryPanelProps = {
  summary: ReviewSummaryDto
}

export function ReviewSummaryPanel({ summary }: ReviewSummaryPanelProps) {
  const average = Number.isFinite(summary.average_rating) ? summary.average_rating : 0
  const total = summary.total_reviews ?? 0

  const byRating = new Map(summary.distribution?.map((bucket) => [bucket.rating, bucket]) ?? [])

  return (
    <div className="grid gap-8 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-10">
      <div className="text-center sm:text-left">
        <p className="font-display text-5xl font-bold leading-none text-black">
          {average.toFixed(1)}
          <span className="font-sans text-xl font-semibold text-zinc-500">/5</span>
        </p>

        <RatingStars
          rating={average}
          size="sm"
          className="mt-2 justify-center sm:justify-start"
          label={`Average rating ${average.toFixed(1)} out of 5`}
        />

        <p className="mt-1.5 font-sans text-xs text-zinc-500">
          Based on {total.toLocaleString('en-IN')} {total === 1 ? 'review' : 'reviews'}
        </p>

        {typeof summary.recommend_percentage === 'number' && summary.recommend_percentage > 0 ? (
          <span className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-sand bg-soft-beige px-3 py-1 font-sans text-xs font-semibold text-espresso">
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {Math.round(summary.recommend_percentage)}% Recommend
          </span>
        ) : null}
      </div>

      <ul className="flex min-w-0 flex-col justify-center gap-2 sm:border-l sm:border-zinc-200 sm:pl-10">
        {[5, 4, 3, 2, 1].map((rating) => {
          const bucket = byRating.get(rating)
          const percentage = Math.max(0, Math.min(100, bucket?.percentage ?? 0))
          const count = bucket?.count ?? 0

          return (
            <li key={rating} className="flex items-center gap-3">
              <span className="flex w-7 shrink-0 items-center gap-0.5 font-sans text-xs font-semibold text-zinc-700">
                {rating}
                <svg className="size-3 text-chocolate" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M12 2.6l2.74 5.55 6.13.89-4.44 4.32 1.05 6.1L12 16.59l-5.48 2.88 1.05-6.1-4.44-4.32 6.13-.89L12 2.6z" />
                </svg>
              </span>

              {/*
                A real progress bar rather than a styled div, so assistive tech reports the
                proportion instead of announcing nothing. The count goes in the label
                because "82%" alone does not say 82% of what.
              */}
              <span
                role="img"
                aria-label={`${rating} star: ${count} ${count === 1 ? 'review' : 'reviews'}, ${percentage}%`}
                className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-soft-beige"
              >
                <span
                  className="block h-full rounded-full bg-chocolate transition-[width] duration-500"
                  style={{ width: `${percentage}%` }}
                />
              </span>

              <span className="w-9 shrink-0 text-right font-sans text-xs text-zinc-500">{percentage}%</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
