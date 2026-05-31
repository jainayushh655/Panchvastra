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
      className="group relative block min-h-0 min-w-0 w-full overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-300 dark:bg-zinc-800 sm:aspect-[16/10]">
        <img
          src={imageUrl}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-500 ease-out motion-reduce:transition-none group-hover:scale-[1.04] motion-reduce:group-hover:scale-100"
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/65 via-black/20 to-transparent"
          aria-hidden
        />
        <p className="absolute bottom-0 left-0 z-[1] p-3 font-display text-lg font-bold tracking-tight text-white drop-shadow-sm sm:p-4 sm:text-xl md:text-2xl">
          {name}
        </p>
      </div>
    </Link>
  )
}

export function FeatureDropsSection() {
  return (
    <section className="w-full overflow-x-hidden border-b border-zinc-200 bg-white dark:border-zinc-800">
      <div className="mx-auto max-w-6xl px-4 pt-10 pb-8 md:pt-8">
        <h2 className="type-section-title text-center">
          Feature drops
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:grid-cols-2 sm:gap-5 lg:gap-6">
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
      className="flex w-full justify-center bg-white py-1"
      aria-hidden
    >
      <div className="h-10 w-px rounded-full bg-gradient-to-b from-zinc-400/60 to-transparent dark:from-zinc-600/50" />
    </div>
  )
}
