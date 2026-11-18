import { useCallback, useEffect, useRef, useState } from 'react'
import { AdminConfirmModal } from '@/admin/components/AdminConfirmModal'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { AdminTable } from '@/admin/components/AdminTable'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import {
  deleteReviewAsAdmin,
  getAdminReviews,
  readReviewApiError,
  setReviewVisibility,
} from '@/api/productReviews'
import { ReviewPhotoLightbox } from '@/components/reviews/ReviewPhotoLightbox'
import { formatOrderDate } from '@/lib/format'
import type { ReviewDto } from '@/types/api/ReviewDto'

/**
 * Review moderation.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * HIDE IS NOT DELETE, AND THE DIFFERENCE MATTERS
 * ──────────────────────────────────────────────────────────────────────────────
 * HIDING a review takes it out of the public list and out of the rating summary, but the
 * review stays: its author can still see and edit it from their order, and it can be
 * unhidden. That is the right tool for something borderline — a complaint with a slur in
 * it, a review of the wrong product — because the customer is not silently erased.
 *
 * DELETING is permanent and removes the customer's own record of what they wrote. It is
 * offered, but it is the second option and it asks first.
 *
 * `include_hidden=true` is sent on every read here, which is the whole point: an admin
 * cannot unhide what they cannot see.
 */

const PAGE_SIZE = 20

type VisibilityFilter = 'all' | 'visible' | 'hidden'

const FILTERS: { key: VisibilityFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'visible', label: 'Visible' },
  { key: 'hidden', label: 'Hidden' },
]

export function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewDto[]>([])
  const [totalRecords, setTotalRecords] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [page, setPage] = useState(1)
  const [productIdFilter, setProductIdFilter] = useState('')
  const [appliedProductId, setAppliedProductId] = useState('')
  const [visibility, setVisibility] = useState<VisibilityFilter>('all')

  const [pendingDelete, setPendingDelete] = useState<ReviewDto | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [lightbox, setLightbox] = useState<{ review: ReviewDto; index: number } | null>(null)

  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const result = await getAdminReviews({
        page,
        page_size: PAGE_SIZE,
        ...(appliedProductId.trim() ? { product_id: appliedProductId.trim() } : {}),
      })
      if (current !== requestId.current) return

      setReviews(result.reviews)
      setTotalRecords(result.pagination?.total_records ?? result.reviews.length)
      setTotalPages(Math.max(1, result.pagination?.total_pages ?? 1))
    } catch (err) {
      if (current !== requestId.current) return
      // A failed request is an error state, never an empty list.
      setReviews([])
      setTotalRecords(0)
      setError(readReviewApiError(err, 'Something went wrong while loading reviews.'))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [page, appliedProductId])

  useEffect(() => {
    void load()
  }, [load])

  /*
   * The visibility filter is applied CLIENT-side because the endpoint has no parameter
   * for it — `include_hidden` only widens the set, it does not narrow it. That means the
   * filter acts on the current page rather than the whole result set, which is why the
   * count below says "on this page" rather than claiming a total.
   */
  const visibleReviews = reviews.filter((review) => {
    if (visibility === 'visible') return review.is_active
    if (visibility === 'hidden') return !review.is_active
    return true
  })

  const handleToggleVisibility = async (review: ReviewDto) => {
    if (busyId !== null) return

    setBusyId(review.id)
    setActionError(null)

    try {
      await setReviewVisibility(review.id, !review.is_active)
      setNotice(review.is_active ? 'Review hidden.' : 'Review restored.')
      // Re-read rather than patching locally: hiding a review also changes the product's
      // rating summary, and the list is the only thing that can confirm the new state.
      await load()
    } catch (err) {
      setActionError(readReviewApiError(err, 'Could not update this review.'))
    } finally {
      setBusyId(null)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return

    const target = pendingDelete
    setPendingDelete(null)
    setActionError(null)

    try {
      await deleteReviewAsAdmin(target.id)
      setNotice('Review deleted.')
      await load()
    } catch (err) {
      setActionError(readReviewApiError(err, 'Could not delete this review.'))
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Community</p>
          <h2>Reviews</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Reviews' }]} />
      </div>

      {notice ? <p className="admin-muted">{notice}</p> : null}
      {actionError ? (
        <p className="admin-form__error" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="admin-toolbar">
        <form
          className="admin-form__row"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            setAppliedProductId(productIdFilter)
          }}
        >
          <div className="admin-form__field">
            <label htmlFor="review-product-filter">Product ID</label>
            <input
              id="review-product-filter"
              type="number"
              min={1}
              placeholder="All products"
              value={productIdFilter}
              onChange={(e) => setProductIdFilter(e.target.value)}
            />
          </div>
          <button type="submit" className="admin-btn admin-btn--ghost">
            Filter
          </button>
        </form>

        <div className="admin-toolbar">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              aria-pressed={visibility === filter.key}
              className={visibility === filter.key ? 'admin-btn' : 'admin-btn admin-btn--ghost'}
              onClick={() => setVisibility(filter.key)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <AdminLoadingState />
      ) : error ? (
        <AdminErrorState title="Unable to load reviews" message={error} onRetry={load} />
      ) : visibleReviews.length === 0 ? (
        <AdminEmptyState
          title="No reviews"
          message={
            reviews.length > 0
              ? 'No reviews on this page match the selected visibility.'
              : 'No customer reviews have been written yet.'
          }
        />
      ) : (
        <>
          <AdminTable
            headers={['Product', 'Rating', 'Review', 'Photos', 'Reviewer', 'Date', 'Status', 'Actions']}
            rows={visibleReviews}
            getRowKey={(row) => String(row.id)}
            renderRow={(row) => (
              <>
                <td className="admin-table__primary">{row.product_name ?? `#${row.product_id}`}</td>
                <td>{row.rating} / 5</td>
                <td className="admin-helpdesk__preview">
                  {row.title ? <strong>{row.title}</strong> : null}
                  {row.title && row.review_text ? ' — ' : null}
                  {row.review_text ?? ''}
                </td>
                <td>
                  {row.images?.length ? (
                    <button
                      type="button"
                      className="admin-link-button"
                      onClick={() => setLightbox({ review: row, index: 0 })}
                    >
                      {row.images.length} photo{row.images.length === 1 ? '' : 's'}
                    </button>
                  ) : (
                    <span className="admin-table__muted">—</span>
                  )}
                </td>
                <td>
                  {row.reviewer_name}
                  {row.is_verified_purchase ? <AdminBadge label="Verified" tone="outline" /> : null}
                </td>
                <td className="admin-table__muted">{formatOrderDate(row.created_at) ?? '—'}</td>
                <td>
                  <AdminBadge
                    label={row.is_active ? 'Visible' : 'Hidden'}
                    tone={row.is_active ? 'solid' : 'outline'}
                  />
                </td>
                <td className="admin-table__actions">
                  <button
                    type="button"
                    className="admin-link-button"
                    onClick={() => void handleToggleVisibility(row)}
                    disabled={busyId === row.id}
                  >
                    {busyId === row.id ? 'Saving…' : row.is_active ? 'Hide' : 'Unhide'}
                  </button>
                  <button
                    type="button"
                    className="admin-link-button admin-link-button--danger"
                    onClick={() => setPendingDelete(row)}
                  >
                    Delete
                  </button>
                </td>
              </>
            )}
          />

          <div className="admin-toolbar">
            <p className="admin-muted">
              {visibility === 'all'
                ? `${totalRecords} review${totalRecords === 1 ? '' : 's'}`
                : `${visibleReviews.length} ${visibility} on this page`}
            </p>

            {totalPages > 1 ? (
              <div className="admin-toolbar">
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </button>
                <span className="admin-muted">
                  Page {page} of {totalPages}
                </span>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost"
                  disabled={page >= totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </button>
              </div>
            ) : null}
          </div>
        </>
      )}

      {lightbox ? (
        <ReviewPhotoLightbox
          images={lightbox.review.images}
          index={lightbox.index}
          reviewerName={lightbox.review.reviewer_name}
          onIndexChange={(index) => setLightbox((current) => (current ? { ...current, index } : current))}
          onClose={() => setLightbox(null)}
        />
      ) : null}

      <AdminConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete review"
        message="This permanently removes the review and the customer's own copy of it. Hiding it instead keeps it recoverable."
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
