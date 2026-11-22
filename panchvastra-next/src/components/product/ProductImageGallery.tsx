'use client'

import { useState } from 'react'
import { BackendImage } from '@/components/BackendImage'

type Props = {
  images: string[]
}

/**
 * PDP gallery.
 *
 * Ported from the Vite component, structure and classes unchanged. Desktop (>= sm) keeps
 * the vertical thumbnail rail beside one large main image; below `sm` the same images are
 * a horizontally swipeable carousel with a position counter and no thumbnail strip.
 *
 * Swiping uses native touch scrolling with CSS scroll-snap — no carousel dependency and no
 * gesture handling — and the track is `overscroll-x-contain` so a swipe never chains out
 * to the page or the browser's back gesture. The track is the only horizontally scrollable
 * element and every slide is exactly one container wide, so the PAGE never gains
 * horizontal overflow.
 *
 * THE ONE CHANGE: `<img>` became `next/image` through `BackendImage`. Each image sits in a
 * box that already declares its 4:5 ratio, so `fill` + `object-cover` renders identically
 * while the box keeps reserving its space before the file arrives. The FIRST image is the
 * PDP's largest contentful paint, so it is `priority` instead of merely eager — it is
 * preloaded rather than discovered when the browser reaches it — and every other image
 * stays lazy. `sizes` is declared per branch so the optimizer, when the image host allows
 * it, serves a phone a phone-sized file instead of a desktop one.
 *
 * Pass a `key` from the caller (the selected variant's sku) to reset the gallery when the
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
              className="relative aspect-[4/5] w-full shrink-0 snap-start bg-zinc-100 dark:bg-zinc-800"
            >
              <BackendImage
                src={src}
                alt={`Product image ${i + 1} of ${list.length}`}
                fill
                sizes="100vw"
                {...(i === 0 ? { priority: true } : { loading: 'lazy' as const })}
                className="object-cover"
              />
            </div>
          ))}
        </div>

        {/* A counter rather than dots: it stays legible for products with many images. */}
        {list.length > 1 ? (
          <span
            aria-live="polite"
            className="pointer-events-none absolute bottom-3 right-3 z-10 bg-black/75 px-2.5 py-1 font-sans text-[11px] font-semibold tracking-wide text-white tabular-nums"
          >
            {activeIndex + 1} / {list.length}
          </span>
        ) : null}
      </div>

      {/* ------------------------------------------- desktop: rail + main image */}
      <div className="@container hidden gap-3 sm:flex sm:flex-row sm:items-start">
        {list.length > 1 ? (
          <div className="flex gap-2 overflow-x-auto sm:max-h-[calc((100cqw-5.75rem)*1.25)] sm:w-20 sm:shrink-0 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto">
            {list.map((src, i) => (
              <button
                key={`${i}-${src}`}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={`View product image ${i + 1}`}
                aria-current={i === activeIndex}
                className={`relative aspect-[4/5] w-16 shrink-0 overflow-hidden border-2 bg-zinc-100 transition-colors sm:w-full dark:bg-zinc-800 ${
                  i === activeIndex ? 'border-black' : 'border-transparent hover:border-zinc-300'
                }`}
              >
                <BackendImage src={src} alt="" fill sizes="80px" loading="lazy" className="object-cover" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="relative aspect-[4/5] flex-1 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          <BackendImage
            src={active}
            alt="Product"
            fill
            sizes="(min-width: 1024px) 45vw, 90vw"
            priority
            className="object-cover"
          />
        </div>
      </div>
    </div>
  )
}
