'use client'

import { BackendImage } from '@/components/BackendImage'
import { MISSING_IMAGE } from '@/lib/homeCategories'
import type { ProductDetailDto } from '@/types/api/ProductDetailDto'

type Props = {
  variants: ProductDetailDto['variants']
  currentIndex: number
  onSelect: (index: number) => void
}

function safeImage(url?: string) {
  const trimmed = url?.trim()
  return trimmed ? trimmed : MISSING_IMAGE
}

/**
 * The "Available Colors" row.
 *
 * Ported from the Vite component. Same native scroll pattern as the gallery's mobile
 * track — scroll-snap, no dependency, no gesture handling — and `overscroll-x-contain`
 * keeps a swipe from chaining out to the page or the browser's back gesture. Classes are
 * unchanged; only `<img>` became `BackendImage` inside the existing 4:5 box, and the
 * missing-image fallback now comes from the one constant the rest of the app uses.
 */
export function ProductVariantPicker({ variants, currentIndex, onSelect }: Props) {
  if (variants.length <= 1) return null

  return (
    <div>
      <p className="font-sans text-sm font-semibold text-zinc-900 dark:text-white">Available Colors</p>

      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Select your preferred color.</p>

      <div className="pv-hide-scrollbar mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1">
        {variants.map((variant, index) => {
          const selected = currentIndex === index

          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onSelect(index)}
              className={`w-24 shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-white transition-all duration-200 dark:bg-zinc-900 ${
                selected
                  ? 'border-black shadow-md ring-2 ring-black/15'
                  : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700'
              }`}
            >
              <div className="relative aspect-[4/5] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <BackendImage
                  src={safeImage(variant.images[0]?.image_url ?? '')}
                  alt={variant.color}
                  fill
                  sizes="96px"
                  loading="lazy"
                  className="object-cover"
                />
              </div>

              <div
                className={`flex h-9 items-center justify-center px-1.5 text-center text-xs font-semibold leading-tight line-clamp-2 ${
                  selected ? 'text-black dark:text-white' : 'text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {variant.color}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
