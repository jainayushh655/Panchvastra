import type { FeatureIconName, ProductFeature } from '@/lib/productFeatures'

/**
 * The feature strip under the gallery: four tiles, divided by thin rules.
 *
 * Every icon is drawn in the same thin-stroke, monochrome language the rest of the
 * storefront uses, so they inherit the page's text colour and carry no colour of their
 * own. No icon library is introduced for four marks.
 */

function IconFabric({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M12 3c-3 2.5-4.5 5.2-4.5 8a4.5 4.5 0 009 0c0-2.8-1.5-5.5-4.5-8z" strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M12 11v10" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M12 16c-1.6-.6-2.8-1.6-3.6-3M12 18.5c1.6-.6 2.8-1.6 3.6-3" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  )
}

function IconStitch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M20.5 3.5L9 15" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M20.5 3.5l-1.2 4.2-3-3 4.2-1.2z" strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M9 15l-2.6 2.6" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M3 21c.8-.3 1.6-.8 2.3-1.5.7-.7 1.2-1.5 1.5-2.3" strokeWidth={1.4} strokeLinecap="round" />
      <path d="M13 19h8" strokeWidth={1.4} strokeLinecap="round" strokeDasharray="2 2.5" />
    </svg>
  )
}

function IconFit({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M12 3.5l8.5 4-8.5 4-8.5-4 8.5-4z" strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M3.5 12l8.5 4 8.5-4" strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M3.5 16.5l8.5 4 8.5-4" strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  )
}

function IconUnisex({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M20 4c0 7.5-4.2 13-9.5 13A5.5 5.5 0 014 11.5C4 7 9.5 4 20 4z" strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M4 20c2.5-5 6.5-9 12-12" strokeWidth={1.4} strokeLinecap="round" />
    </svg>
  )
}

function IconCare({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M12 3.5s5.5 5.2 5.5 9a5.5 5.5 0 01-11 0c0-3.8 5.5-9 5.5-9z" strokeWidth={1.4} strokeLinejoin="round" />
    </svg>
  )
}

function IconGeneric({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="8.5" strokeWidth={1.4} />
      <path d="M8.5 12.2l2.5 2.5 4.5-5" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const ICONS: Record<FeatureIconName, (props: { className?: string }) => React.ReactElement> = {
  fabric: IconFabric,
  stitch: IconStitch,
  fit: IconFit,
  unisex: IconUnisex,
  care: IconCare,
  generic: IconGeneric,
}

export function ProductFeatureStrip({ features }: { features: ProductFeature[] }) {
  // No highlights configured and no fabric data: render nothing rather than an empty rule.
  if (features.length === 0) return null

  return (
    <section
      aria-label="Product features"
      className="mt-8 border-y border-zinc-200 py-5 sm:mt-10"
    >
      {/*
        Two columns on a phone, one row from `sm` up. A four-across row at 375px would
        give each tile about 80px, which is not enough for "240 GSM Cotton" to stay on one
        line — it wraps mid-word and the row's heights disagree.
      */}
      <ul className="grid grid-cols-2 gap-x-4 gap-y-5 sm:flex sm:items-center sm:justify-between sm:gap-0">
        {features.map((feature, index) => {
          const Icon = ICONS[feature.icon] ?? IconGeneric

          return (
            <li
              key={`${feature.eyebrow}-${feature.text}`}
              className={`flex min-w-0 items-center gap-3 sm:flex-1 sm:justify-center sm:px-3 ${
                index > 0 ? 'sm:border-l sm:border-zinc-200' : ''
              }`}
            >
              <Icon className="size-7 shrink-0 text-espresso sm:size-8" />
              <div className="min-w-0">
                {feature.eyebrow ? (
                  <p className="font-sans text-[11px] leading-tight text-zinc-500">{feature.eyebrow}</p>
                ) : null}
                <p className="font-sans text-sm font-semibold leading-snug text-black">{feature.text}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
