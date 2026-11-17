import api from './axios'
import { adminAuthConfig, MissingAdminSessionError } from './adminRequest'

import type {
  CreateReviewDto,
  ReviewDto,
  ReviewListDataDto,
  ReviewPaginationDto,
  ReviewQuery,
  ReviewSummaryDto,
  UpdateReviewDto,
} from '@/types/api/ReviewDto'

export { MissingAdminSessionError }

/**
 * Product reviews service — `/v1/product_reviews/`.
 *
 * THREE DIFFERENT CALLERS, three different credentials, and they never mix:
 *   - The public list on a product page is anonymous (or carries the shopper's token,
 *     which only affects `is_mine`). It is a PUBLIC GET, so a stale token no longer 401s:
 *     the backend answers as a guest and flags the dead token in a response header, which
 *     the shared client handles by logging out silently.
 *   - Create / edit / delete go out as the signed-in customer. The shared client attaches
 *     their token.
 *   - Moderation passes `adminAuthConfig()` explicitly, exactly as every other admin
 *     surface does, so a shopper's token can never reach it.
 */

const PATH = '/v1/product_reviews/'

type Envelope<T> = {
  success?: boolean
  message?: unknown
  data?: T
  pagination?: ReviewPaginationDto | null
}

/* ------------------------------------------------------------------ messages */

/** Flattens the two `message` shapes this backend uses (a string, or field→messages). */
export function readReviewApiMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim()) return message.trim()

  if (message && typeof message === 'object') {
    const parts: string[] = []
    for (const value of Object.values(message as Record<string, unknown>)) {
      if (Array.isArray(value)) parts.push(...value.filter((v): v is string => typeof v === 'string'))
      else if (typeof value === 'string') parts.push(value)
    }
    if (parts.length) return parts.join(' ')
  }

  return fallback
}

/** `message` split per field, so the review form can mark the input that was rejected. */
export function readReviewFieldErrors(error: unknown): Record<string, string> {
  const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message
  if (!message || typeof message !== 'object') return {}

  const errors: Record<string, string> = {}
  for (const [field, value] of Object.entries(message as Record<string, unknown>)) {
    const first = Array.isArray(value)
      ? value.find((entry): entry is string => typeof entry === 'string')
      : typeof value === 'string'
        ? value
        : undefined
    if (first) errors[field] = first
  }
  return errors
}

/** Turns a thrown request error into a message that is safe to put on screen. */
export function readReviewApiError(error: unknown, fallback: string): string {
  if (error instanceof MissingAdminSessionError) return error.message

  const response = (error as { response?: { status?: number; data?: Envelope<unknown> } }).response
  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const status = response.status
  // 5xx bodies can carry a Django debug page or raw SQL — never surface one.
  if (status && status >= 500) return 'The server is temporarily unavailable. Please try again shortly.'

  const message = readReviewApiMessage(response.data?.message, '')
  if (message) return message

  if (status === 401) return 'Please sign in to write a review.'
  if (status === 403) return 'You can only review a product you have received.'
  if (status === 404) return 'That review could not be found.'
  if (status === 429) return 'Too many requests. Please try again in a moment.'

  return fallback
}

/**
 * The id of an EXISTING review, read off a 409 from `createReview`.
 *
 * 409 means "you have already reviewed this order item". The backend hands back the
 * existing `review_id` precisely so the UI can switch into edit mode instead of showing a
 * dead end, which is what the caller does with this.
 */
export function readAlreadyReviewedId(error: unknown): number | null {
  const response = (
    error as {
      response?: { status?: number; data?: { review_id?: unknown; data?: { review_id?: unknown } } }
    }
  ).response

  if (response?.status !== 409) return null

  // The contract puts it in the envelope's `data` block. The top level is also checked
  // because this backend is inconsistent about which of the two carries a scalar, and
  // reading the wrong one would silently fail the "open edit mode instead" path — the
  // shopper would be told they have already reviewed the item and given no way through.
  const candidates = [response.data?.data?.review_id, response.data?.review_id]

  for (const candidate of candidates) {
    const parsed = typeof candidate === 'number' ? candidate : Number(candidate)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }

  return null
}

/* ------------------------------------------------------------------ query */

/** Drops empty values so only parameters the caller actually set reach the wire. */
function toParams(query: ReviewQuery): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {}
  if (query.product_id !== undefined && query.product_id !== '') params.product_id = query.product_id
  if (query.page !== undefined) params.page = query.page
  if (query.page_size !== undefined) params.page_size = query.page_size
  if (query.sort_by) params.sort_by = query.sort_by
  // Sent only when true: an explicit `with_photos=false` is not part of the contract.
  if (query.with_photos) params.with_photos = true
  if (query.include_hidden) params.include_hidden = true
  return params
}

export interface ReviewListResult {
  summary: ReviewSummaryDto | null
  reviews: ReviewDto[]
  pagination: ReviewPaginationDto | null
}

/** An all-zero summary, so a product with no reviews renders its empty state cleanly. */
export const EMPTY_REVIEW_SUMMARY: ReviewSummaryDto = {
  average_rating: 0,
  total_reviews: 0,
  recommend_percentage: 0,
  with_photos_count: 0,
  distribution: [5, 4, 3, 2, 1].map((rating) => ({ rating, count: 0, percentage: 0 })),
}

/**
 * Reads the list envelope.
 *
 * `data` is an OBJECT here (`{ summary, reviews }`), not an array as on most list
 * endpoints — a shape worth being defensive about, because treating it as an array would
 * silently yield an empty reviews block rather than an error.
 */
function readListResponse(body: Envelope<ReviewListDataDto> | undefined): ReviewListResult {
  const data = body?.data

  // The documented shape. Checked first so the normal path is the obvious one.
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return {
      summary: data.summary ?? null,
      reviews: Array.isArray(data.reviews) ? data.reviews : [],
      pagination: body?.pagination ?? null,
    }
  }

  /*
   * A bare array under `data`, which is what every OTHER list endpoint on this backend
   * returns. Accepted because the moderation read is the same URL with one extra
   * parameter, and it would be a plausible shape for it to come back in. Treating it as
   * "no reviews" would show an empty moderation screen over a populated database — a
   * failure that looks exactly like success.
   */
  if (Array.isArray(data)) {
    return { summary: null, reviews: data as ReviewDto[], pagination: body?.pagination ?? null }
  }

  return { summary: null, reviews: [], pagination: body?.pagination ?? null }
}

/* ------------------------------------------------------------------ public read */

/**
 * `GET /v1/product_reviews/?product_id=…` — one page of reviews plus the summary.
 *
 * The summary comes back on every call and is scoped to the current filter, so switching
 * to the photos tab must use the summary from THAT response rather than the one cached
 * from the all-reviews tab.
 */
export async function getProductReviews(query: ReviewQuery): Promise<ReviewListResult> {
  const response = await api.get<Envelope<ReviewListDataDto>>(PATH, { params: toParams(query) })
  return readListResponse(response.data)
}

/**
 * `GET /v1/product_reviews/?id=…` — a single review, for prefilling the edit form.
 *
 * The author can read their own review even when an admin has hidden it, which is why
 * editing still works from the order page after moderation.
 */
export async function getReviewById(reviewId: number | string): Promise<ReviewDto | null> {
  const response = await api.get<Envelope<ReviewDto>>(PATH, { params: { id: reviewId } })
  const data = response.data?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return data
}

/* ------------------------------------------------------------------ write */

/**
 * Builds the multipart body for a create or edit that carries photos.
 *
 * `images` is repeated once per file and `delete_image_ids` once per id — that repetition
 * is how the backend receives a list, exactly as the product-image contract works.
 * Booleans go as "true"/"false", which is what Django's form parsing expects.
 */
function toReviewFormData(
  fields: Record<string, unknown>,
  images: File[],
  deleteImageIds?: number[],
): FormData {
  const form = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue
    form.append(key, typeof value === 'boolean' ? String(value) : String(value))
  }

  for (const id of deleteImageIds ?? []) form.append('delete_image_ids', String(id))
  for (const file of images) form.append('images', file)

  return form
}

/**
 * `Content-Type` unset so the browser generates the multipart boundary itself. Setting it
 * to "multipart/form-data" by hand omits the boundary and the request fails to parse.
 */
const MULTIPART_CONFIG = { headers: { 'Content-Type': undefined } }

/**
 * `POST /v1/product_reviews/` — writes a review for a delivered order item.
 *
 * JSON when there are no photos, multipart when there are, so the simple case stays a
 * plain JSON request. Returns the new review's id.
 *
 * Callers must handle 409 via `readAlreadyReviewedId` and switch to edit mode.
 */
export async function createReview(payload: CreateReviewDto, images: File[] = []): Promise<number | null> {
  const response = images.length
    ? await api.post<Envelope<{ id?: number }>>(
        PATH,
        toReviewFormData(payload as unknown as Record<string, unknown>, images),
        MULTIPART_CONFIG,
      )
    : await api.post<Envelope<{ id?: number }>>(PATH, payload)

  const id = response.data?.data?.id
  return typeof id === 'number' ? id : null
}

/**
 * `PUT /v1/product_reviews/` — edits an existing review.
 *
 * Multipart whenever photos are added OR removed; JSON otherwise. The backend enforces the
 * five-photo ceiling across what remains plus what is added, so the form checks it too
 * rather than letting the shopper discover it on submit.
 */
export async function updateReview(payload: UpdateReviewDto, images: File[] = []): Promise<ReviewDto | null> {
  const { delete_image_ids: deleteImageIds, ...fields } = payload
  const needsMultipart = images.length > 0 || (deleteImageIds?.length ?? 0) > 0

  const response = needsMultipart
    ? await api.put<Envelope<ReviewDto>>(
        PATH,
        toReviewFormData(fields as unknown as Record<string, unknown>, images, deleteImageIds),
        MULTIPART_CONFIG,
      )
    : await api.put<Envelope<ReviewDto>>(PATH, payload)

  const data = response.data?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return data
}

/** `DELETE /v1/product_reviews/?id=…` — the author removing their own review. */
export async function deleteReview(reviewId: number | string): Promise<void> {
  await api.delete<Envelope<unknown>>(PATH, { params: { id: reviewId } })
}

/* ------------------------------------------------------------------ admin */

/**
 * `GET /v1/product_reviews/?include_hidden=true` — moderation list.
 *
 * Without `product_id` it spans every product. Hidden reviews are included, which is the
 * whole point: an admin needs to see what they have hidden in order to unhide it.
 */
export async function getAdminReviews(query: ReviewQuery = {}): Promise<ReviewListResult> {
  const response = await api.get<Envelope<ReviewListDataDto>>(PATH, {
    ...adminAuthConfig(),
    params: toParams({ ...query, include_hidden: true }),
  })
  return readListResponse(response.data)
}

/**
 * `PUT /v1/product_reviews/` with `{ id, is_active }` — hide or unhide (admin).
 *
 * Hiding is a moderation action, not a delete: the review stays, its author can still see
 * and edit it, and it simply stops counting towards the public list and summary.
 */
export async function setReviewVisibility(reviewId: number, isActive: boolean): Promise<ReviewDto | null> {
  const response = await api.put<Envelope<ReviewDto>>(
    PATH,
    { id: reviewId, is_active: isActive },
    adminAuthConfig(),
  )
  const data = response.data?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return data
}

/** `DELETE /v1/product_reviews/?id=…` as an admin — permanent removal. */
export async function deleteReviewAsAdmin(reviewId: number): Promise<void> {
  await api.delete<Envelope<unknown>>(PATH, { ...adminAuthConfig(), params: { id: reviewId } })
}
