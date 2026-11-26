import { useEffect, useState } from 'react'
import { OVERLAY_Z, Portal } from '@/components/ui/Portal'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'

/**
 * "THE DETAILS — Crafted in Every Stitch".
 *
 * The heading and eyebrow are fixed editorial copy, exactly as the design specifies. Only
 * the body text and the checklist come from the product: `description` and the admin's
 * `key_highlights`.
 *
 * The image is a detail shot taken from the variant's own gallery — the SECOND image when
 * there is one, because the first is the hero already shown at the top of the page and
 * repeating it here says nothing new. It falls back to the first, and the section renders
 * without an image rather than with a placeholder when the variant has none.
 *
 * The whole section hides when there is neither a description nor a highlight, so a
 * sparsely-filled product does not get a heading with nothing under it.
 */

type ProductStorySectionProps = {
  description?: string | null
  highlights: string[]
  imageUrl?: string | null
  productName: string
}

function IconExpand({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M9 4H4v5M15 4h5v5M15 20h5v-5M9 20H4v-5" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ProductStorySection({
  description,
  highlights,
  imageUrl,
  productName,
}: ProductStorySectionProps) {
  const body = description?.trim()
  const items = highlights.filter((item) => item.trim())

  const [zoomed, setZoomed] = useState(false)

  // Shared, reference-counted lock — see `useBodyScrollLock` for why the per-component
  // save-and-restore this replaces broke whenever two overlays were open at once.
  useBodyScrollLock(zoomed)

  useEffect(() => {
    if (!zoomed) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setZoomed(false)
    }
    window.addEventListener('keydown', onKey)

    return () => window.removeEventListener('keydown', onKey)
  }, [zoomed])

  if (!body && items.length === 0) return null

  return (
    <section aria-labelledby="product-details-heading" className="mt-12 sm:mt-16">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,38fr)_minmax(0,62fr)] lg:items-center lg:gap-12">
        {imageUrl ? (
          <div className="relative overflow-hidden rounded-xl bg-soft-beige">
            <img
              src={imageUrl}
              alt={`${productName} detail`}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] h-full w-full object-cover"
            />

            <button
              type="button"
              onClick={() => setZoomed(true)}
              aria-label="View this detail larger"
              className="absolute right-3 top-3 flex size-9 items-center justify-center rounded-lg border border-sand bg-cream/85 text-espresso backdrop-blur-sm transition-colors hover:bg-cream"
            >
              <IconExpand className="size-4" />
            </button>
          </div>
        ) : null}

        <div className="min-w-0">
          <p className="type-eyebrow">The Details</p>

          <h2
            id="product-details-heading"
            className="mt-2 font-display text-2xl font-bold italic leading-tight tracking-tight text-black sm:text-3xl"
          >
            Crafted in Every Stitch
          </h2>

          {body ? <p className="type-body mt-4 max-w-prose">{body}</p> : null}

          {items.length > 0 ? (
            // Two columns from `sm` up, one at 375px — a two-column checklist that narrow
            // wraps every line and reads worse than a single list.
            <ul className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              {items.map((item, index) => (
                <li
                  key={item}
                  /*
                   * The hairline between the two columns, as in the design. A `grid` flows
                   * row-major, so the right-hand column is every ODD index — the rule goes
                   * on those rather than on a wrapper, which a two-column grid has no place
                   * for. Hidden below `sm`, where the list is a single column and a left
                   * border would read as a stray mark.
                   */
                  className={`flex items-start gap-2.5 ${
                    index % 2 === 1 ? 'sm:border-l sm:border-zinc-200 sm:pl-8' : ''
                  }`}
                >
                  <svg
                    className="mt-0.5 size-4 shrink-0 text-espresso"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    aria-hidden
                  >
                    <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="font-sans text-sm font-medium leading-snug text-black">{item}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {/* Portalled to the body: this section sits inside the product page's grid, and an
          overlay left in that subtree is ranked inside whatever stacking context an
          ancestor happens to create rather than against the page. See `Portal`. */}
      {zoomed && imageUrl ? (
        <Portal>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${productName} detail`}
            className={`fixed inset-0 ${OVERLAY_Z.lightbox} flex items-center justify-center bg-espresso/95 p-4`}
            onClick={() => setZoomed(false)}
          >
            <button
              type="button"
              onClick={() => setZoomed(false)}
              aria-label="Close"
              className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full border border-cream/40 text-cream transition-colors hover:bg-cream/10"
            >
              <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" strokeWidth={1.8} strokeLinecap="round" />
              </svg>
            </button>

            <img
              src={imageUrl}
              alt={`${productName} detail`}
              onClick={(event) => event.stopPropagation()}
              className="max-h-[88vh] max-w-full rounded-lg object-contain"
            />
          </div>
        </Portal>
      ) : null}
    </section>
  )
}
