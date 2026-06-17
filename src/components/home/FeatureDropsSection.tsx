import { Link } from 'react-router-dom'

/** Local hero tiles under `public/images/` (replace files anytime). */
const BOX_BG_TEE = '/images/feature-drop-tee.jpg'
const BOX_BG_SHORTS = '/images/feature-drop-shorts.jpg'

type DropBoxProps = {
  to: string
  imageUrl: string
  name: string
  ariaLabel: string
}

function DropBox({ to, imageUrl, name, ariaLabel }: DropBoxProps) {
  return (
    <Link
      to={to}
      aria-label={ariaLabel}
      className="group relative block min-w-0 max-w-full overflow-hidden rounded-[1.75rem] border border-white/40 bg-white shadow-[0_18px_50px_-28px_rgba(0,0,0,0.45)] ring-1 ring-zinc-200/60 transition-transform duration-300 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
    >
      {/*
        Padding-bottom aspect ratio scales with container width (works at every breakpoint).
        Mobile: 4:3 (75%). Tablet+: 16:10 (62.5%).
      */}
      <div className="relative w-full max-w-full overflow-hidden bg-zinc-300 pb-[75%] sm:pb-[62.5%]">
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          sizes="(max-width: 640px) 100vw, (max-width: 1152px) 50vw, 560px"
          className="absolute inset-0 block h-full w-full max-w-full object-cover object-center transition-transform duration-500 ease-out motion-reduce:transition-none group-hover:scale-[1.04] motion-reduce:group-hover:scale-100"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%] bg-gradient-to-t from-black/75 via-black/25 to-transparent"
          aria-hidden
        />
        <p className="absolute bottom-0 left-0 z-[1] p-4 font-display text-lg font-bold tracking-tight text-white drop-shadow-sm sm:p-5 sm:text-xl md:text-2xl">
          {name}
        </p>
      </div>
    </Link>
  )
}

export function FeatureDropsSection() {
  return (
    <section className="overflow-x-hidden border-b border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,251,240,0.96),rgba(255,255,255,0.92))] px-4 pb-10 pt-10 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-zinc-800 md:pt-10">
      <div className="mx-auto w-full max-w-6xl min-w-0">
        <div className="mx-auto max-w-2xl text-center">
          <p className="type-eyebrow text-[#8a7355]">Feature drops</p>
          <h2 className="type-section-title mt-2 text-balance text-center">
            Curated pairs with a cleaner, sharper presentation.
          </h2>
        </div>

        <div className="mt-8 grid w-full min-w-0 grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:gap-6 [&>*]:min-w-0">
          <DropBox
            to="/shop?category=regular-tee"
            imageUrl={BOX_BG_TEE}
            name="T-shirts"
            ariaLabel="Shop T-shirts"
          />
          <DropBox
            to="/shop?category=shorts"
            imageUrl={BOX_BG_SHORTS}
            name="Shorts"
            ariaLabel="Shop shorts"
          />
        </div>
      </div>
    </section>
  )
}

export function FeatureToProductsConnector() {
  return (
    <div
      className="flex w-full justify-center bg-transparent py-3"
      aria-hidden
    >
      <div className="h-12 w-px rounded-full bg-gradient-to-b from-[#d6b36d]/70 via-[#8a7355]/40 to-transparent" />
    </div>
  )
}
