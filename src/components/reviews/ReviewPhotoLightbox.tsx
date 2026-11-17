import { useEffect } from 'react'
import type { ReviewImageDto } from '@/types/api/ReviewDto'

/**
 * Fullscreen viewer for a review's photos.
 *
 * Customer photos are the single most useful thing in a review — they show the garment on
 * a real body, in real light — so they need to be viewable at a size where that is
 * actually legible, not just as 64px thumbnails.
 *
 * Keyboard: Escape closes, arrows page. The arrow handlers wrap, so paging never dead-ends
 * at either edge of a short set.
 */

type ReviewPhotoLightboxProps = {
  images: ReviewImageDto[]
  index: number
  onIndexChange: (index: number) => void
  onClose: () => void
  /** Whose photos these are, for the dialog's accessible name. */
  reviewerName?: string
}

export function ReviewPhotoLightbox({
  images,
  index,
  onIndexChange,
  onClose,
  reviewerName,
}: ReviewPhotoLightboxProps) {
  const count = images.length

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onIndexChange((index + 1) % count)
      if (event.key === 'ArrowLeft') onIndexChange((index - 1 + count) % count)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, count, onClose, onIndexChange])

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  if (count === 0) return null

  const current = images[Math.min(index, count - 1)]

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={reviewerName ? `Photos from ${reviewerName}'s review` : 'Review photos'}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-espresso/90 p-4"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full border border-cream/40 text-cream transition-colors hover:bg-cream/10"
      >
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" strokeWidth={1.8} strokeLinecap="round" />
        </svg>
      </button>

      <img
        src={current?.image_url}
        alt={reviewerName ? `Photo from ${reviewerName}'s review` : 'Customer photo'}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[86vh] max-w-full rounded-lg object-contain"
      />

      {count > 1 ? (
        <>
          <button
            type="button"
            aria-label="Previous photo"
            onClick={(event) => {
              event.stopPropagation()
              onIndexChange((index - 1 + count) % count)
            }}
            className="absolute left-3 flex size-10 items-center justify-center rounded-full border border-cream/40 text-cream transition-colors hover:bg-cream/10"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path d="M15 5l-7 7 7 7" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Next photo"
            onClick={(event) => {
              event.stopPropagation()
              onIndexChange((index + 1) % count)
            }}
            className="absolute right-3 flex size-10 items-center justify-center rounded-full border border-cream/40 text-cream transition-colors hover:bg-cream/10"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path d="M9 5l7 7-7 7" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <p className="absolute bottom-5 font-sans text-xs text-cream/80" aria-live="polite">
            {index + 1} of {count}
          </p>
        </>
      ) : null}
    </div>
  )
}
