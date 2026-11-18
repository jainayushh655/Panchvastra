import { RatingStars } from '@/components/product/RatingStars'
import { formatOrderDate } from '@/lib/format'
import type { ReviewDto } from '@/types/api/ReviewDto'

/**
 * One review.
 *
 * Layout follows the design: identity and meta on the left, photo thumbnails on the right
 * from `sm` up, stacked on a phone.
 *
 * A few deliberate choices:
 *   - The avatar is the first letter of `reviewer_name`. No image is involved anywhere in
 *     the review contract, and inventing a generated avatar would imply a profile picture
 *     that does not exist.
 *   - "Verified Purchase" shows only when the backend says so. It is a trust signal, and
 *     a trust signal that appears unconditionally is worthless.
 *   - The fit line is omitted entirely when `fit_feedback_label` is null — the question is
 *     optional, so a dash or "Not specified" would be noise on most reviews.
 *   - Edit / Delete appear only for `is_mine`, which the backend decides from the token.
 */

type ReviewCardProps = {
  review: ReviewDto
  onPhotoClick: (review: ReviewDto, imageIndex: number) => void
  onEdit?: (review: ReviewDto) => void
  onDelete?: (review: ReviewDto) => void
  /** Shown in the admin moderation list; hidden on the storefront. */
  showProductName?: boolean
}

export function ReviewCard({ review, onPhotoClick, onEdit, onDelete, showProductName = false }: ReviewCardProps) {
  const initial = review.reviewer_name?.trim()?.charAt(0)?.toUpperCase() || '?'
  const date = formatOrderDate(review.created_at)

  const meta = [
    review.size ? `Size: ${review.size}` : null,
    review.fit_feedback_label ? `Fit: ${review.fit_feedback_label}` : null,
    review.color ? `Colour: ${review.color}` : null,
  ].filter(Boolean)

  return (
    <article className="border-b border-zinc-200 py-6 last:border-b-0">
      <div className="flex gap-3 sm:gap-4">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-sand bg-soft-beige font-sans text-sm font-bold text-espresso"
        >
          {initial}
        </span>

        <div className="grid min-w-0 flex-1 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="font-sans text-sm font-bold text-black">{review.reviewer_name}</p>

              {review.is_verified_purchase ? (
                <span className="inline-flex items-center gap-1 font-sans text-[11px] font-semibold text-zinc-600">
                  <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                    <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Verified Purchase
                </span>
              ) : null}

              <RatingStars rating={review.rating} size="sm" label={`${review.rating} out of 5`} />

              {/* Pushed to the end of the row on wider screens so the date column lines up
                  down the list, as in the design. */}
              {date ? <time dateTime={review.created_at} className="ml-auto font-sans text-xs text-zinc-500">{date}</time> : null}
            </div>

            {showProductName && review.product_name ? (
              <p className="mt-1 font-sans text-xs font-semibold text-zinc-600">{review.product_name}</p>
            ) : null}

            {meta.length > 0 ? (
              <p className="mt-1 font-sans text-xs text-zinc-500">{meta.join('  |  ')}</p>
            ) : null}

            {review.title?.trim() ? (
              <h4 className="mt-2 font-sans text-sm font-bold text-black">{review.title}</h4>
            ) : null}

            {review.review_text?.trim() ? (
              <p className="mt-1 whitespace-pre-line font-sans text-sm leading-relaxed text-zinc-700">
                {review.review_text}
              </p>
            ) : null}

            {/* Only surfaced for the author's own review and in moderation — the public
                list never shows a hidden review at all. */}
            {!review.is_active ? (
              <p className="mt-2 inline-flex items-center rounded-md border border-sand px-2 py-0.5 font-sans text-[11px] font-semibold uppercase tracking-wide text-zinc-600">
                Hidden by moderation
              </p>
            ) : null}

            {review.is_mine && (onEdit || onDelete) ? (
              <div className="mt-3 flex items-center gap-4">
                {onEdit ? (
                  <button
                    type="button"
                    onClick={() => onEdit(review)}
                    className="font-sans text-xs font-semibold uppercase tracking-wide text-black underline underline-offset-2"
                  >
                    Edit
                  </button>
                ) : null}
                {onDelete ? (
                  <button
                    type="button"
                    onClick={() => onDelete(review)}
                    className="font-sans text-xs font-semibold uppercase tracking-wide text-burgundy underline underline-offset-2"
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {review.images?.length ? (
            <ul className="flex shrink-0 gap-2 sm:justify-end">
              {review.images.slice(0, 3).map((image, index) => (
                <li key={image.id}>
                  <button
                    type="button"
                    onClick={() => onPhotoClick(review, index)}
                    aria-label={`View photo ${index + 1} from ${review.reviewer_name}'s review`}
                    className="relative block size-16 overflow-hidden rounded-md border border-zinc-200 transition-colors hover:border-sand sm:size-20"
                  >
                    <img
                      src={image.image_url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full bg-soft-beige object-cover"
                    />
                    {/* The third tile doubles as "+N more" when the review has more than
                        three photos, so none are silently unreachable. */}
                    {index === 2 && review.images.length > 3 ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-espresso/60 font-sans text-xs font-bold text-cream">
                        +{review.images.length - 3}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </article>
  )
}
