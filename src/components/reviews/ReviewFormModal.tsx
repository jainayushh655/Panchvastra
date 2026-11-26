import { useEffect, useId, useRef, useState } from 'react'
import { OVERLAY_Z, Portal } from '@/components/ui/Portal'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import {
  createReview,
  getReviewById,
  readAlreadyReviewedId,
  readReviewApiError,
  readReviewFieldErrors,
  updateReview,
} from '@/api/productReviews'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/context/ToastProvider'
import {
  FIT_FEEDBACK_OPTIONS,
  MAX_REVIEW_PHOTOS,
  type FitFeedback,
  type ReviewImageDto,
} from '@/types/api/ReviewDto'

/**
 * Write or edit a review.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY IT TAKES AN `orderItemId` AND NOT A `productId`
 * ──────────────────────────────────────────────────────────────────────────────
 * A review is attached to a delivered ORDER ITEM, not to a product. That is what makes
 * "Verified Purchase" true by construction, pins the size and colour the reviewer
 * actually received, and limits each customer to one review per item. There is
 * deliberately no path from the product page into this form for that reason — the entry
 * point is the order.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE 409 CASE
 * ──────────────────────────────────────────────────────────────────────────────
 * Creating a review for an item that already has one answers 409 and hands back the
 * existing `review_id`. That is not an error worth showing: the form silently switches
 * into edit mode on that id and loads it. It happens in practice whenever someone has the
 * order page open in two tabs, or taps "Write a review" on a stale page.
 */

type ReviewFormTarget =
  /** Writing a new review for a delivered order item. */
  | { mode: 'create'; orderItemId: number }
  /** Editing an existing one. */
  | { mode: 'edit'; reviewId: number }

type ReviewFormModalProps = {
  target: ReviewFormTarget
  /** Shown as read-only context so the reviewer knows exactly what they are reviewing. */
  context?: { productName?: string | null; size?: string | null; color?: string | null }
  onClose: () => void
  /** Called after a successful save, so the caller can refresh its list. */
  onSaved: () => void
  /**
   * The reviews endpoint is not reachable on this backend.
   *
   * The form still opens and is fully usable — hiding it made the feature look unbuilt
   * and left nothing to test against. It simply says so up front, so nobody writes a
   * review and discovers at submit that it cannot be saved.
   */
  unavailable?: boolean
}

type PendingPhoto = { key: string; file: File; previewUrl: string }

let photoSeq = 0

function StarInput({ value, onChange, describedBy }: { value: number; onChange: (next: number) => void; describedBy?: string }) {
  return (
    <div role="radiogroup" aria-label="Rating" aria-describedby={describedBy} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="radio"
          aria-checked={value === star}
          aria-label={`${star} star${star === 1 ? '' : 's'}`}
          onClick={() => onChange(star)}
          className="p-0.5 text-chocolate transition-transform hover:scale-110"
        >
          <svg
            className="size-8"
            viewBox="0 0 24 24"
            fill={star <= value ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth={star <= value ? 0 : 1.5}
            aria-hidden
          >
            <path
              d="M12 2.6l2.74 5.55 6.13.89-4.44 4.32 1.05 6.1L12 16.59l-5.48 2.88 1.05-6.1-4.44-4.32 6.13-.89L12 2.6z"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ))}
    </div>
  )
}

export function ReviewFormModal({
  target,
  context,
  onClose,
  onSaved,
  unavailable = false,
}: ReviewFormModalProps) {
  const { showToast } = useToast()
  const ids = useId()
  const fid = (name: string) => `${ids}-${name}`

  /** Switches to edit when a create returns 409, so the id is state rather than a prop. */
  const [editingId, setEditingId] = useState<number | null>(target.mode === 'edit' ? target.reviewId : null)

  const [rating, setRating] = useState(0)
  const [title, setTitle] = useState('')
  const [reviewText, setReviewText] = useState('')
  const [isRecommended, setIsRecommended] = useState(true)
  const [fitFeedback, setFitFeedback] = useState<FitFeedback | ''>('')

  const [existingPhotos, setExistingPhotos] = useState<ReviewImageDto[]>([])
  const [removedPhotoIds, setRemovedPhotoIds] = useState<number[]>([])
  const [newPhotos, setNewPhotos] = useState<PendingPhoto[]>([])

  const [loading, setLoading] = useState(target.mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  /** Synchronous guard — state is not applied in time to stop a double submit. */
  const inFlight = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  /** Object URLs must be revoked or the blobs leak for the life of the tab. */
  useEffect(
    () => () => {
      for (const photo of newPhotos) URL.revokeObjectURL(photo.previewUrl)
    },
    [newPhotos],
  )

  // Freezes the page behind the dialog. Shared and reference-counted, because these
  // dialogs stack (the address picker opens the address form over itself) and a
  // per-component save-and-restore unlocks the page while one is still open.
  useBodyScrollLock(true)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  /** Loads an existing review into the form. Also used after a 409 switches to edit mode. */
  useEffect(() => {
    if (editingId == null) return

    let active = true
    setLoading(true)

    getReviewById(editingId)
      .then((review) => {
        if (!active || !review) return
        setRating(review.rating ?? 0)
        setTitle(review.title ?? '')
        setReviewText(review.review_text ?? '')
        setIsRecommended(review.is_recommended !== false)
        setFitFeedback(review.fit_feedback ?? '')
        setExistingPhotos(review.images ?? [])
        setRemovedPhotoIds([])
      })
      .catch((error) => {
        if (active) setFormError(readReviewApiError(error, 'Could not load your review.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [editingId])

  const keptPhotos = existingPhotos.filter((photo) => !removedPhotoIds.includes(photo.id))
  const totalPhotos = keptPhotos.length + newPhotos.length
  const remainingSlots = Math.max(0, MAX_REVIEW_PHOTOS - totalPhotos)

  const handleFiles = (files: FileList | null) => {
    if (!files?.length) return

    const accepted: PendingPhoto[] = []
    let rejected = 0

    for (const file of Array.from(files)) {
      if (accepted.length >= remainingSlots) {
        rejected += 1
        continue
      }
      // Only a type check — the contract specifies no size limit for review photos, and
      // inventing one would reject uploads the backend would have accepted.
      if (!file.type?.startsWith('image/')) {
        rejected += 1
        continue
      }
      accepted.push({ key: `photo-${++photoSeq}`, file, previewUrl: URL.createObjectURL(file) })
    }

    if (accepted.length) setNewPhotos((previous) => [...previous, ...accepted])
    if (rejected > 0) {
      showToast('Some photos were skipped', {
        variant: 'warning',
        description: `You can attach up to ${MAX_REVIEW_PHOTOS} images.`,
      })
    }

    // Reset so picking the same file twice in a row still fires `change`.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeNewPhoto = (key: string) => {
    setNewPhotos((previous) => {
      const target = previous.find((photo) => photo.key === key)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return previous.filter((photo) => photo.key !== key)
    })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return

    if (rating < 1) {
      setFormError('Please choose a rating.')
      return
    }

    inFlight.current = true
    setSaving(true)
    setFormError(null)
    setFieldErrors({})

    const files = newPhotos.map((photo) => photo.file)

    try {
      if (editingId != null) {
        await updateReview(
          {
            id: editingId,
            rating,
            title: title.trim(),
            review_text: reviewText.trim(),
            is_recommended: isRecommended,
            // Omitted entirely when unset: the fit question is optional, and sending an
            // empty string would be a validation error rather than "no answer".
            ...(fitFeedback ? { fit_feedback: fitFeedback } : {}),
            ...(removedPhotoIds.length ? { delete_image_ids: removedPhotoIds } : {}),
          },
          files,
        )
        showToast('Review updated')
      } else if (target.mode === 'create') {
        await createReview(
          {
            order_item_id: target.orderItemId,
            rating,
            title: title.trim(),
            review_text: reviewText.trim(),
            is_recommended: isRecommended,
            ...(fitFeedback ? { fit_feedback: fitFeedback } : {}),
          },
          files,
        )
        showToast('Thanks for your review')
      }

      onSaved()
      onClose()
      return
    } catch (error) {
      // Already reviewed: switch to editing the review that exists rather than failing.
      const existingId = readAlreadyReviewedId(error)
      if (existingId != null) {
        setEditingId(existingId)
        setFormError('You have already reviewed this item — your existing review is loaded for editing.')
        return
      }

      setFieldErrors(readReviewFieldErrors(error))
      setFormError(readReviewApiError(error, 'Could not save your review. Please try again.'))
    } finally {
      inFlight.current = false
      setSaving(false)
    }
  }

  const contextLine = [context?.size ? `Size ${context.size}` : null, context?.color]
    .filter(Boolean)
    .join(' · ')

  /* Portalled to `document.body` — see `Portal` for why a `z-index` alone cannot keep
     an overlay above the page it covers. */
  return (
    <Portal>
      <div
        className={`fixed inset-0 ${OVERLAY_Z.modal} flex items-end justify-center bg-espresso/40 sm:items-center sm:p-4`}
        onClick={() => !saving && onClose()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={fid('heading')}
          onClick={(event) => event.stopPropagation()}
          className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border border-zinc-200 bg-white shadow-[0_30px_60px_-36px_rgba(43,23,17,0.4)] sm:max-h-[90vh] sm:rounded-2xl"
        >
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 p-5 sm:p-6">
            <div className="min-w-0">
              <p className="type-eyebrow">{editingId != null ? 'Edit review' : 'Write a review'}</p>
              <h2 id={fid('heading')} className="mt-1 truncate font-display text-lg font-bold tracking-tight text-black">
                {context?.productName ?? 'Your review'}
              </h2>
              {contextLine ? <p className="type-body-sm mt-0.5">{contextLine}</p> : null}
            </div>

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              aria-label="Close"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition-colors hover:border-black hover:text-black disabled:opacity-50"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" strokeWidth={1.8} strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {loading ? (
            <div className="p-10 text-center font-sans text-sm text-zinc-500">Loading your review…</div>
          ) : (
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
                {/*
                  Stated at the TOP, before anything is typed — the whole point is that the
                  warning arrives before the effort, not after it.
                */}
                {unavailable ? (
                  <p className="rounded-lg border border-sand bg-soft-beige px-3.5 py-3 font-sans text-xs leading-relaxed text-espresso">
                    <strong className="font-bold">Reviews aren&rsquo;t live yet.</strong> You can fill
                    this in to see how it works, but it can&rsquo;t be saved until reviews are enabled
                    on the server.
                  </p>
                ) : null}

                <div>
                  <p className="font-sans text-sm font-semibold text-black">Your rating</p>
                  <StarInput value={rating} onChange={setRating} describedBy={fieldErrors.rating ? fid('rating-error') : undefined} />
                  {fieldErrors.rating ? (
                    <p id={fid('rating-error')} className="mt-1 font-sans text-xs text-burgundy">
                      {fieldErrors.rating}
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor={fid('title')} className="font-sans text-sm font-semibold text-black">
                    Title
                  </label>
                  <input
                    id={fid('title')}
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={150}
                    placeholder="Sum it up in a few words"
                    className="mt-1.5 w-full rounded-lg border border-zinc-300 px-3 py-2.5 focus:border-chocolate focus:outline-none"
                  />
                  {fieldErrors.title ? <p className="mt-1 font-sans text-xs text-burgundy">{fieldErrors.title}</p> : null}
                </div>

                <div>
                  <label htmlFor={fid('text')} className="font-sans text-sm font-semibold text-black">
                    Your review
                  </label>
                  <textarea
                    id={fid('text')}
                    value={reviewText}
                    onChange={(event) => setReviewText(event.target.value)}
                    maxLength={2000}
                    rows={4}
                    placeholder="How is the fabric, the fit, the print?"
                    className="mt-1.5 w-full resize-y rounded-lg border border-zinc-300 px-3 py-2.5 focus:border-chocolate focus:outline-none"
                  />
                  <p className="mt-1 text-right font-sans text-[11px] text-zinc-400">{reviewText.length}/2000</p>
                  {fieldErrors.review_text ? (
                    <p className="font-sans text-xs text-burgundy">{fieldErrors.review_text}</p>
                  ) : null}
                </div>

                <div>
                  <p className="font-sans text-sm font-semibold text-black">How did it fit?</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {FIT_FEEDBACK_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={fitFeedback === option.value}
                        // Tapping the chosen option again clears it — the question is
                        // optional and there has to be a way back to "no answer".
                        onClick={() => setFitFeedback((current) => (current === option.value ? '' : option.value))}
                        className={`rounded-full border px-3.5 py-1.5 font-sans text-xs font-semibold transition-colors ${
                          fitFeedback === option.value
                            ? 'border-chocolate bg-chocolate text-cream'
                            : 'border-zinc-300 text-zinc-700 hover:border-sand'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={isRecommended}
                    onChange={(event) => setIsRecommended(event.target.checked)}
                    className="size-4 accent-[var(--color-chocolate)]"
                  />
                  <span className="font-sans text-sm text-black">I recommend this product</span>
                </label>

                <div>
                  <p className="font-sans text-sm font-semibold text-black">
                    Photos <span className="font-normal text-zinc-500">({totalPhotos}/{MAX_REVIEW_PHOTOS})</span>
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {keptPhotos.map((photo) => (
                      <div key={photo.id} className="relative size-20 overflow-hidden rounded-md border border-zinc-200">
                        <img src={photo.image_url} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setRemovedPhotoIds((previous) => [...previous, photo.id])}
                          aria-label="Remove photo"
                          className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-espresso/75 text-cream"
                        >
                          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                            <path d="M6 6l12 12M18 6L6 18" strokeWidth={2.4} strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    {newPhotos.map((photo) => (
                      <div key={photo.key} className="relative size-20 overflow-hidden rounded-md border border-zinc-200">
                        <img src={photo.previewUrl} alt="" className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeNewPhoto(photo.key)}
                          aria-label="Remove photo"
                          className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-espresso/75 text-cream"
                        >
                          <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                            <path d="M6 6l12 12M18 6L6 18" strokeWidth={2.4} strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    ))}

                    {remainingSlots > 0 ? (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex size-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-zinc-300 text-zinc-500 transition-colors hover:border-sand hover:text-black"
                      >
                        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                          <path d="M12 5v14M5 12h14" strokeWidth={1.6} strokeLinecap="round" />
                        </svg>
                        <span className="font-sans text-[10px] font-semibold uppercase">Add</span>
                      </button>
                    ) : null}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) => handleFiles(event.target.files)}
                    className="sr-only"
                  />
                </div>

                {formError ? (
                  <p role="alert" className="rounded-lg border border-sand bg-soft-beige px-3 py-2 font-sans text-xs text-espresso">
                    {formError}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 gap-3 border-t border-zinc-200 p-5 sm:p-6">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? 'Saving…' : editingId != null ? 'Update review' : 'Post review'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Portal>
  )
}
