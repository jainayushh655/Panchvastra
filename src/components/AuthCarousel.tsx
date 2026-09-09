import { useRef, useState } from 'react'
import { useAuthCarousel } from '@/hooks/useAuthCarousel'
import type { AuthCarouselDto } from '@/types/api/AuthCarouselDto'

type Props = {
  /**
   * Aspect ratio of one slide. The default suits an in-page band; the auth panel passes
   * `h-full` instead so the slides fill the brand column.
   */
  slideClassName?: string
  /** Extra classes for the outer wrapper (spacing, background, rounding). */
  className?: string
  /** Rendered while the request is in flight, sized like a slide to avoid layout shift. */
  showSkeleton?: boolean
}

/**
 * The one Auth Carousel used across the storefront — Home, Login and Signup all render
 * this component, and all of them get their data from `useAuthCarousel`, so there is a
 * single fetch/filter/order implementation and a single presentation.
 *
 * Only active images arrive here, already ordered by `display_order` ascending.
 *
 * Scrolling is native: a scroll-snap track, so a touch swipe on mobile and a trackpad
 * swipe on desktop work with no gesture library and no drag handlers. The track is
 * `overscroll-x-contain` so a swipe never chains out to the page or the browser's back
 * gesture, and every slide is exactly one track wide, so the page itself never gains
 * horizontal overflow — only the track scrolls.
 *
 * Renders nothing at all when there are no active images.
 */
export function AuthCarousel({
  slideClassName = 'aspect-[16/9]',
  className = '',
  showSkeleton = true,
}: Props) {
  const { images, loading } = useAuthCarousel()
  /**
   * Images the browser could not load — a URL the API still lists but that no longer
   * resolves, or one served from a host the browser rejects. Dropping the slide is the
   * only way to honour "never show a broken image" for a URL that fails after the
   * successful API response, and it never hides an image that actually loads.
   */
  const [failedIds, setFailedIds] = useState<number[]>([])

  const visible = images.filter((image) => !failedIds.includes(image.id))

  if (loading) {
    // Same footprint as a slide, so the surrounding page does not jump when data lands.
    return showSkeleton ? (
      <div className={className} aria-hidden>
        <div className={`w-full ${slideClassName} animate-pulse bg-zinc-100 dark:bg-zinc-800`} />
      </div>
    ) : null
  }

  if (visible.length === 0) return null

  return (
    <div className={className}>
      <AuthCarouselTrack
        images={visible}
        slideClassName={slideClassName}
        onImageError={(id) => setFailedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
      />
    </div>
  )
}

function AuthCarouselTrack({
  images,
  slideClassName,
  onImageError,
}: {
  images: AuthCarouselDto[]
  slideClassName: string
  onImageError: (id: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const total = images.length

  // Scrolls to a slide using the platform's own smooth scrolling — the dots are desktop's
  // horizontal navigation, and cost no gesture handling.
  const goTo = (index: number) => {
    const track = trackRef.current
    if (!track) return
    track.scrollTo({ left: track.clientWidth * index, behavior: 'smooth' })
  }

  return (
    <div className="relative h-full">
      <div
        ref={trackRef}
        // The active slide is derived from scroll position, so it stays correct whether the
        // customer swipes, flicks, or a dot scrolls the track programmatically.
        onScroll={(event) => {
          const track = event.currentTarget
          const slideWidth = track.clientWidth || 1
          const next = Math.min(Math.max(Math.round(track.scrollLeft / slideWidth), 0), total - 1)
          setActiveIndex((prev) => (prev === next ? prev : next))
        }}
        className="pv-hide-scrollbar flex h-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
        role="group"
        aria-label={`Panchvastra highlights, ${total} in total`}
      >
        {images.map((image, index) => (
          <div
            key={image.id}
            // The slide carries the shape (an aspect band on the homepage, `h-full` in the
            // auth panel); the image always fills it.
            className={`w-full shrink-0 snap-start bg-zinc-100 dark:bg-zinc-900 ${slideClassName}`}
          >
            <img
              src={image.image_url}
              alt=""
              className="block h-full w-full object-cover"
              loading={index === 0 ? 'eager' : 'lazy'}
              draggable={false}
              onError={() => onImageError(image.id)}
            />
          </div>
        ))}
      </div>

      {total > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex items-center justify-center gap-2">
          {images.map((image, index) => (
            <button
              key={image.id}
              type="button"
              onClick={() => goTo(index)}
              aria-label={`Go to slide ${index + 1} of ${total}`}
              aria-current={index === activeIndex}
              className="pointer-events-auto flex h-6 items-center justify-center px-1"
            >
              {/* The dot is drawn by the inner span so the button keeps a comfortable tap
                  area without changing the visual size. */}
              <span
                className={`block h-1.5 rounded-full transition-all ${
                  index === activeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                }`}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
