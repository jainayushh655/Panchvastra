import { useEffect, useMemo, useRef, useState } from 'react'
import type { MediaType, VariantImageDto } from '@/types/api/ProductDetailDto'

/**
 * Product gallery — images and video in one ordered strip.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THIS REPLACES THE OLD IMAGE-ONLY GALLERY ON THE PRODUCT PAGE
 * ──────────────────────────────────────────────────────────────────────────────
 * The previous gallery took `string[]` and assumed every entry was an image. Variants can
 * now carry video, which the backend marks with `media_type` on each item, so the gallery
 * has to take the real objects: a URL alone cannot tell you whether to render `<img>` or
 * `<video>`, and sniffing the file extension would be a guess that breaks on a signed URL
 * with query parameters.
 *
 * Items arrive already sorted by `display_order`; nothing here re-sorts them.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * TWO RULES WORTH KEEPING
 * ──────────────────────────────────────────────────────────────────────────────
 * 1. Only IMAGE items go into the fullscreen lightbox. A `<video>` already has its own
 *    fullscreen control, and putting one inside a custom overlay means reimplementing
 *    playback controls badly. The expand button is therefore hidden while a video is
 *    selected.
 *
 * 2. Switching colour must stop any playing video. The parent remounts this component per
 *    variant (via `key`), which handles it structurally rather than relying on an effect
 *    to chase down a `<video>` element that is already being unmounted.
 */

type GalleryItem = {
  id: number | string
  url: string
  type: MediaType
}

const PLACEHOLDER = '/images/no-image.png'

/** An absent `media_type` means IMAGE — which is what every item was before video existed. */
function toGalleryItems(images: VariantImageDto[] | undefined, fallbackUrls: string[]): GalleryItem[] {
  if (images?.length) {
    return images.map((image, index) => ({
      id: image.id ?? `img-${index}`,
      url: image.image_url?.trim() || PLACEHOLDER,
      type: image.media_type === 'VIDEO' ? 'VIDEO' : 'IMAGE',
    }))
  }

  // The mapped product's plain URLs, used only when the variant carries no media at all.
  if (fallbackUrls.length) {
    return fallbackUrls.map((url, index) => ({ id: `fallback-${index}`, url: url || PLACEHOLDER, type: 'IMAGE' as const }))
  }

  return [{ id: 'placeholder', url: PLACEHOLDER, type: 'IMAGE' }]
}

function IconExpand({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconPlay({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9.2 7.4a.6.6 0 01.93-.5l6 4.6a.6.6 0 010 1l-6 4.6a.6.6 0 01-.93-.5V7.4z" />
    </svg>
  )
}

type ProductMediaGalleryProps = {
  images: VariantImageDto[] | undefined
  /** Plain URLs from the mapped product, used only when the variant has no media. */
  fallbackUrls?: string[]
  productName: string
}

export function ProductMediaGallery({ images, fallbackUrls = [], productName }: ProductMediaGalleryProps) {
  const items = useMemo(() => toGalleryItems(images, fallbackUrls), [images, fallbackUrls])

  const [activeIndex, setActiveIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const active = items[Math.min(activeIndex, items.length - 1)] ?? items[0]
  const isVideo = active?.type === 'VIDEO'

  /** Lightbox paging walks IMAGE items only, so it can never land on a video. */
  const imageItems = useMemo(() => items.filter((item) => item.type === 'IMAGE'), [items])
  const [lightboxIndex, setLightboxIndex] = useState(0)

  // Moving to another item must silence whatever was playing; a video that keeps going
  // off-screen is the single most annoying thing a gallery can do.
  useEffect(() => {
    const video = videoRef.current
    if (video && !video.paused) video.pause()
  }, [activeIndex])

  // Body scroll lock while the lightbox is open, restored exactly as it was.
  useEffect(() => {
    if (!lightboxOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [lightboxOpen])

  useEffect(() => {
    if (!lightboxOpen) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightboxOpen(false)
      if (event.key === 'ArrowRight') setLightboxIndex((i) => (i + 1) % Math.max(1, imageItems.length))
      if (event.key === 'ArrowLeft') setLightboxIndex((i) => (i - 1 + imageItems.length) % Math.max(1, imageItems.length))
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightboxOpen, imageItems.length])

  const openLightbox = () => {
    if (!active || active.type !== 'IMAGE') return
    const position = imageItems.findIndex((item) => item.id === active.id)
    setLightboxIndex(position >= 0 ? position : 0)
    setLightboxOpen(true)
  }

  return (
    <div>
      {/*
        Thumbnails run down the left from `sm` up and along the bottom on a phone, which is
        what keeps the main image as large as possible at 375px.
      */}
      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
        {items.length > 1 ? (
          <ul
            className="pv-hide-scrollbar flex shrink-0 gap-3 overflow-x-auto sm:max-h-[520px] sm:w-[76px] sm:flex-col sm:overflow-y-auto"
            aria-label="Product media"
          >
            {items.map((item, index) => {
              const selected = index === activeIndex

              return (
                <li key={item.id} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-current={selected}
                    aria-label={
                      item.type === 'VIDEO'
                        ? `Play video ${index + 1} of ${items.length}`
                        : `View image ${index + 1} of ${items.length}`
                    }
                    className={`relative block aspect-[4/5] w-[62px] overflow-hidden rounded-lg border transition-colors sm:w-full ${
                      selected ? 'border-chocolate' : 'border-zinc-200 hover:border-sand'
                    }`}
                  >
                    {item.type === 'VIDEO' ? (
                      <>
                        {/*
                          `preload="metadata"` so the browser fetches just enough to paint a
                          first frame as the thumbnail, instead of either downloading the
                          whole clip or showing a blank tile.
                        */}
                        <video
                          src={item.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="h-full w-full bg-soft-beige object-cover"
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-espresso/25" aria-hidden>
                          <span className="flex size-6 items-center justify-center rounded-full bg-cream/90 text-espresso">
                            <IconPlay className="size-4" />
                          </span>
                        </span>
                      </>
                    ) : (
                      <img
                        src={item.url}
                        alt=""
                        loading="lazy"
                        className="h-full w-full bg-soft-beige object-cover"
                      />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}

        <div className="relative min-w-0 flex-1">
          <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-soft-beige">
            {isVideo ? (
              <video
                ref={videoRef}
                key={active.url}
                src={active.url}
                controls
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : (
              <img
                src={active?.url ?? PLACEHOLDER}
                alt={productName}
                className="h-full w-full object-cover"
              />
            )}

            {/* Hidden for video: a `<video>` has its own fullscreen control, and wrapping
                one in a custom overlay means rebuilding playback controls badly. */}
            {!isVideo ? (
              <button
                type="button"
                onClick={openLightbox}
                aria-label="View larger image"
                className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg border border-sand bg-cream/85 text-espresso backdrop-blur-sm transition-colors hover:bg-cream"
              >
                <IconExpand className="size-4" />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {lightboxOpen && imageItems.length > 0 ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${productName} images`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-espresso/90 p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="Close"
            className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full border border-cream/40 text-cream transition-colors hover:bg-cream/10"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" strokeWidth={1.8} strokeLinecap="round" />
            </svg>
          </button>

          <img
            src={imageItems[lightboxIndex]?.url ?? PLACEHOLDER}
            alt={productName}
            // Stops a click on the image itself from closing the dialog behind it.
            onClick={(event) => event.stopPropagation()}
            className="max-h-[88vh] max-w-full rounded-lg object-contain"
          />

          {imageItems.length > 1 ? (
            <>
              <button
                type="button"
                aria-label="Previous image"
                onClick={(event) => {
                  event.stopPropagation()
                  setLightboxIndex((i) => (i - 1 + imageItems.length) % imageItems.length)
                }}
                className="absolute left-3 flex size-10 items-center justify-center rounded-full border border-cream/40 text-cream transition-colors hover:bg-cream/10"
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                  <path d="M15 5l-7 7 7 7" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Next image"
                onClick={(event) => {
                  event.stopPropagation()
                  setLightboxIndex((i) => (i + 1) % imageItems.length)
                }}
                className="absolute right-3 flex size-10 items-center justify-center rounded-full border border-cream/40 text-cream transition-colors hover:bg-cream/10"
              >
                <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                  <path d="M9 5l7 7-7 7" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
