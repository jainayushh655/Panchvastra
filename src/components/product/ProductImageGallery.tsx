import { useState } from 'react'

type Props = {
  images: string[]
}

/** PDP gallery: vertical thumbnail rail + one large main image. Pass a `key` from the
 * caller (e.g. the selected variant index) to reset the active thumbnail when the
 * underlying image set changes. */
export function ProductImageGallery({ images }: Props) {
  const list = images.filter(Boolean)
  const [activeIndex, setActiveIndex] = useState(0)

  if (!list.length) return null

  const active = list[Math.min(activeIndex, list.length - 1)]

  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row">
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
        <img
          src={active}
          alt="Product"
          className="block aspect-[4/5] w-full object-cover"
          loading="eager"
        />
      </div>
    </div>
  )
}
