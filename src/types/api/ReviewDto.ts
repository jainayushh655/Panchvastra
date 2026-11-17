/**
 * Product reviews — `/v1/product_reviews/`.
 *
 * WHO CAN WRITE ONE. Only a customer with a **DELIVERED** order, once per order item. The
 * entry point is therefore the order detail screen, not the product page: a review is
 * attached to an `order_item_id`, which is what makes "Verified Purchase" mean something
 * and what stops the same person reviewing a product repeatedly.
 */

/** How the garment fitted, as the backend stores it. */
export type FitFeedback = 'RUNS_SMALL' | 'PERFECT' | 'SLIGHTLY_OVERSIZED' | 'RUNS_LARGE'

/** The four options, in the order they are shown, with the labels the shopper reads. */
export const FIT_FEEDBACK_OPTIONS: { value: FitFeedback; label: string }[] = [
  { value: 'RUNS_SMALL', label: 'Runs Small' },
  { value: 'PERFECT', label: 'Perfect' },
  { value: 'SLIGHTLY_OVERSIZED', label: 'Slightly Oversized' },
  { value: 'RUNS_LARGE', label: 'Runs Large' },
]

/** Sort orders the list endpoint accepts. `recent` is the default. */
export type ReviewSortBy = 'recent' | 'highest' | 'lowest' | 'oldest'

export const REVIEW_SORT_OPTIONS: { value: ReviewSortBy; label: string }[] = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'highest', label: 'Highest Rated' },
  { value: 'lowest', label: 'Lowest Rated' },
  { value: 'oldest', label: 'Oldest' },
]

export interface ReviewImageDto {
  id: number
  image_url: string
}

export interface ReviewDto {
  id: number
  product_id: number
  /** 1–5. */
  rating: number
  title: string | null
  review_text: string | null
  is_recommended: boolean
  /** Null when the reviewer skipped the optional fit question. */
  fit_feedback: FitFeedback | null
  /** Display form of `fit_feedback`. Null when that is null — the card hides the fit part. */
  fit_feedback_label: string | null
  /** Size and colour the reviewer actually bought, from their order item. */
  size: string | null
  color: string | null
  reviewer_name: string
  is_verified_purchase: boolean
  /** True for the signed-in user's own review — the card then offers Edit / Delete. */
  is_mine: boolean
  /**
   * False when an admin has hidden the review.
   *
   * A hidden review is absent from the public list entirely; it is visible only to its own
   * author (who may still edit it) and in the admin moderation screen.
   */
  is_active: boolean
  created_at: string
  updated_at: string
  images: ReviewImageDto[]
  /** Admin moderation list only — which product the review belongs to. */
  product_name?: string | null
}

/** One bar of the 5★→1★ breakdown. */
export interface ReviewDistributionBucketDto {
  rating: number
  count: number
  /** Whole percent of all reviews, already computed — the bar width. */
  percentage: number
}

/**
 * Aggregate figures for the reviews block.
 *
 * Recomputed on EVERY list call, including when `with_photos=true` is sent, so it must be
 * re-read when switching tabs rather than cached from the first load.
 */
export interface ReviewSummaryDto {
  average_rating: number
  total_reviews: number
  recommend_percentage: number
  /** Drives the "With Photos (46)" tab count. */
  with_photos_count: number
  distribution: ReviewDistributionBucketDto[]
}

/** `data` of a list response: the summary and this page of reviews together. */
export interface ReviewListDataDto {
  summary: ReviewSummaryDto
  reviews: ReviewDto[]
}

/** The reviews endpoint's pagination block. */
export interface ReviewPaginationDto {
  page: number
  page_size: number
  total_records: number
  total_pages: number
  has_next: boolean
  has_previous: boolean
}

/** Query parameters for the public list. */
export interface ReviewQuery {
  product_id?: number | string
  page?: number
  page_size?: number
  sort_by?: ReviewSortBy
  /** Restricts to reviews that have photos; `total_records` then counts only those. */
  with_photos?: boolean
  /** Admin moderation only — includes reviews an admin has hidden. */
  include_hidden?: boolean
}

/**
 * Fields for creating a review.
 *
 * Sent as JSON when there are no photos and as `multipart/form-data` when there are, so
 * the plain fields are typed here and the files are passed separately.
 */
export interface CreateReviewDto {
  /** Required. Identifies both the product and the delivered purchase being reviewed. */
  order_item_id: number
  /** Required, 1–5. */
  rating: number
  /** ≤ 150 characters. */
  title?: string
  /** ≤ 2000 characters. */
  review_text?: string
  /** Defaults to true server-side. */
  is_recommended?: boolean
  fit_feedback?: FitFeedback
}

/**
 * Fields for editing. Only what actually changed needs sending — an omitted key is left
 * as-is by the backend, so the form diffs against the loaded review rather than
 * re-submitting everything.
 */
export interface UpdateReviewDto {
  id: number
  rating?: number
  title?: string
  review_text?: string
  is_recommended?: boolean
  fit_feedback?: FitFeedback
  /** Ids of existing photos to drop. Repeated as a multipart field. */
  delete_image_ids?: number[]
}

/** Hard cap the backend enforces, mirrored client-side so the picker can stop earlier. */
export const MAX_REVIEW_PHOTOS = 5
