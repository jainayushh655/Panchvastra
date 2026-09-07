import { useState } from 'react'

type Props = {
  images: string[]
}

/**
 * PDP gallery.
 *
 * Desktop (>= sm) keeps the original arrangement: a vertical thumbnail rail beside one large
 * main image. Below sm the same images become a horizontally swipeable carousel with a small
 * position counter and no thumbnail strip, which keeps the page compact however many images
 * a product has.
 *
 * Swiping uses native touch scrolling with CSS scroll-snap — no carousel dependency — and the
 * track is `overscroll-x-contain` so a swipe never chains out to the page or the browser's
 * back gesture. The track is the only horizontally scrollable element; every slide is exactly
 * one container wide, so the page itself never gains horizontal overflow.
 *
 * Pass a `key` from the caller (e.g. the selected variant index) to reset the gallery when the
 * underlying image set changes.
 */
export function ProductImageGallery({ images }: Props) {
  const list = images.filter(Boolean)
  const [activeIndex, setActiveIndex] = useState(0)

  if (!list.length) return null

  const active = list[Math.min(activeIndex, list.length - 1)]

  return (
    <div>
      {/* ---------------------------------------------------------- mobile: swipe carousel */}
      <div className="relative sm:hidden">
        <div
          // The active slide is derived from scroll position, so it stays correct whether the
          // customer swipes, flicks, or the track is scrolled programmatically.
          onScroll={(event) => {
            const track = event.currentTarget
            const slideWidth = track.clientWidth || 1
            const next = Math.min(Math.max(Math.round(track.scrollLeft / slideWidth), 0), list.length - 1)
            setActiveIndex((prev) => (prev === next ? prev : next))
          }}
          className="pv-hide-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
          role="group"
          aria-label={`Product images, ${list.length} in total`}
        >
          {list.map((src, i) => (
            <div
              key={`slide-${i}-${src}`}
              className="w-full shrink-0 snap-start bg-zinc-100 dark:bg-zinc-800"
            >
              <img
                src={src}
                alt={`Product image ${i + 1} of ${list.length}`}
                className="block aspect-[4/5] w-full object-cover"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
            </div>
          ))}
        </div>

        {/* A counter rather than dots: it stays legible for products with many images. */}
        {list.length > 1 ? (
          <span
            aria-live="polite"
            className="pointer-events-none absolute bottom-3 right-3 bg-black/75 px-2.5 py-1 font-sans text-[11px] font-semibold tracking-wide text-white tabular-nums"
          >
            {activeIndex + 1} / {list.length}
          </span>
        ) : null}
      </div>

      {/* ------------------------------------------- desktop: unchanged rail + main image */}
      <div className="hidden gap-3 sm:flex sm:flex-row">
        {list.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto sm:w-20 sm:shrink-0 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto">
            {list.map((src, i) => (
              <button
                key={`${i}-${src}`}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={`View product image ${i + 1}`}
                aria-current={i === activeIndex}
                className={`aspect-[4/5] w-16 shrink-0 overflow-hidden border-2 bg-zinc-100 transition-colors sm:w-full dark:bg-zinc-800 ${
                  i === activeIndex ? 'border-black' : 'border-transparent hover:border-zinc-300'
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          <img src={active} alt="Product" className="block aspect-[4/5] w-full object-cover" loading="eager" />
        </div>
      </div>
    </div>
  )
}
