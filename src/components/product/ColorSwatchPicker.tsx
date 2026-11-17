import type { VariantDto } from '@/types/api/ProductDetailDto'

/**
 * `Select Color: Off White` + a row of image swatches.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ONE DETAIL THAT MATTERS: THE SWATCH IS THE FIRST **IMAGE**
 * ──────────────────────────────────────────────────────────────────────────────
 * `variants[].images` is a mixed, ordered list of images and video. Taking `images[0]`
 * blindly — as the older picker does — renders a `<video>` URL into an `<img>` as soon as
 * an admin puts a clip first, and the swatch silently becomes a broken image. So this
 * finds the first entry whose `media_type` is not `VIDEO`, and falls back to the
 * placeholder when a variant somehow has video only.
 *
 * The selected colour's NAME is shown in the label rather than on each swatch, which is
 * what keeps the row compact enough to fit three or four swatches at 375px without
 * scrolling.
 */

const PLACEHOLDER = '/images/no-image.png'

/** First non-video entry. An absent `media_type` means IMAGE, as it always did. */
function swatchImage(variant: VariantDto): string {
  const image = variant.images?.find((item) => item.media_type !== 'VIDEO')
  return image?.image_url?.trim() || PLACEHOLDER
}

type ColorSwatchPickerProps = {
  variants: VariantDto[]
  currentIndex: number
  onSelect: (index: number) => void
}

export function ColorSwatchPicker({ variants, currentIndex, onSelect }: ColorSwatchPickerProps) {
  // A single-colour product has no choice to offer; the row would be decoration.
  if (!variants || variants.length <= 1) return null

  const selected = variants[currentIndex]

  return (
    <div>
      <p className="font-sans text-sm font-semibold text-black">
        Select Color:{' '}
        <span className="font-normal text-zinc-600">{selected?.color ?? '—'}</span>
      </p>

      {/*
        `role="radiogroup"` because this is one choice among several, not a set of
        independent buttons. Each swatch carries its colour name as its accessible name,
        since the image alone tells a screen reader nothing.
      */}
      <div
        role="radiogroup"
        aria-label="Colour"
        className="pv-hide-scrollbar mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto overscroll-x-contain pb-1"
      >
        {variants.map((variant, index) => {
          const isSelected = index === currentIndex
          const outOfStock = variant.in_stock === false

          return (
            <button
              key={variant.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={outOfStock ? `${variant.color} — out of stock` : variant.color}
              title={variant.color}
              onClick={() => onSelect(index)}
              className={`relative h-[68px] w-[104px] shrink-0 snap-start overflow-hidden rounded-lg border-2 transition-all ${
                isSelected ? 'border-burgundy' : 'border-zinc-200 hover:border-sand'
              }`}
            >
              <img
                src={swatchImage(variant)}
                alt=""
                loading="lazy"
                className={`h-full w-full bg-soft-beige object-cover ${outOfStock ? 'opacity-55' : ''}`}
              />

              {/* A sold-out colour stays selectable: the shopper should be able to look at
                  it and use Notify Me, rather than finding it simply missing. */}
              {outOfStock ? (
                <span className="absolute inset-x-0 bottom-0 bg-espresso/70 py-0.5 text-center font-sans text-[9px] font-bold uppercase tracking-wide text-cream">
                  Sold out
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
