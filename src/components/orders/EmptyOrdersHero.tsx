import { Link } from 'react-router-dom'
import { categoryNameToSlug } from '@/lib/categorySlug'

/**
 * The Orders page when the customer has never ordered.
 *
 * This is a destination rather than a notice: an empty orders list is the one screen a new
 * customer is guaranteed to reach, so it carries the page's own heading, a route back into
 * the catalogue, and the reassurance strip — instead of a one-line "no orders yet" box.
 *
 * It is shown ONLY for a genuinely empty account. A filter that happens to match nothing
 * keeps the normal list view and its own message, because "you haven't placed any orders
 * yet" would be untrue there.
 */

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16m0 0-6-6m6 6-6 6" />
    </svg>
  )
}

function IconTruck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M2.5 6.5h11v9h-11z" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M13.5 9.5h4l4 3.5v2.5h-8z" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx="7" cy="17.5" r="1.9" strokeWidth={1.5} />
      <circle cx="17.5" cy="17.5" r="1.9" strokeWidth={1.5} />
    </svg>
  )
}

function IconBox({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M12 2.8 21 7.4v9.2L12 21.2 3 16.6V7.4z" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M3 7.4 12 12m0 0 9-4.6M12 12v9.2" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  )
}

function IconShield({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M12 2.6 20 6v6.2c0 4.3-3.3 7.6-8 9.2-4.7-1.6-8-4.9-8-9.2V6z" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="m8.6 12 2.4 2.4 4.4-4.6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/**
 * Fades the artwork's four edges into the card.
 *
 * Two gradients intersected rather than one radial: the bag fills most of the frame, so a
 * radial fade wide enough to reach the corners also dims the bag itself. These stops are
 * chosen against where the bag actually sits — it starts ~30% from the left and ends ~88%
 * down — so every fade happens over backdrop only and the bag stays fully opaque.
 */
const EDGE_FADE = {
  maskImage:
    'linear-gradient(to right, transparent 0, #000 24%, #000 95%, transparent 100%), linear-gradient(to bottom, transparent 0, #000 8%, #000 93%, transparent 100%)',
  WebkitMaskImage:
    'linear-gradient(to right, transparent 0, #000 24%, #000 95%, transparent 100%), linear-gradient(to bottom, transparent 0, #000 8%, #000 93%, transparent 100%)',
  maskComposite: 'intersect',
  WebkitMaskComposite: 'source-in',
} as const

/**
 * The shopping-bag illustration.
 *
 * This is the supplied brand artwork, served from `public/images/`, not a hand-drawn SVG.
 * Earlier attempts to reproduce the photograph in paths kept missing it — the bag's
 * perspective, the rope handle's droop and the softness of the shading are photographic,
 * and approximating them produced something that read as a cardboard box. Using the real
 * asset is exact by definition.
 *
 * Decorative: the empty state is fully described by the heading and copy beside it, so an
 * empty `alt` plus `aria-hidden` keeps a screen reader from announcing a picture of a bag.
 * `width`/`height` are set so the browser reserves the box and the card does not reflow as
 * it loads.
 */
function BagIllustration({ className }: { className?: string }) {
  return (
    <img
      src="/images/orders-empty-bag.png"
      alt=""
      aria-hidden
      // Below the fold of the first screen on most viewports, and purely decorative.
      loading="lazy"
      decoding="async"
      width={471}
      height={327}
      className={className}
      /*
       * The artwork is a tight crop: its backdrop arch runs off the left edge and its own
       * background sits a couple of percent cooler than the card's, so dropped in flat it
       * reads as a pasted-in rectangle. This radial mask fades the outer edge into the
       * card. The stop is set so the bag and its shadow stay fully opaque — only the
       * surrounding backdrop dissolves.
       */
      style={EDGE_FADE}
    />
  )
}

const ASSURANCES = [
  { Icon: IconTruck, title: 'Free Shipping', caption: 'On all orders' },
  { Icon: IconBox, title: 'Easy Returns', caption: 'Hassle-free 7 day returns' },
  { Icon: IconShield, title: 'Secure Payments', caption: '100% safe and secure' },
]

export function EmptyOrdersHero() {
  // Built from the shared slug helper rather than a literal, so this link and the Shop
  // page's own category filter can never drift apart.
  const tshirtsTo = `/shop?category=${categoryNameToSlug('T-Shirts')}`

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-[#f7f7f5]">
      <div className="grid items-center gap-8 px-6 py-10 sm:px-10 sm:py-12 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Orders</p>

          {/* The page's only h1 — the hero replaces the standard header when it is shown,
              so the heading lives here rather than being duplicated above. */}
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-black sm:text-5xl">My Orders</h1>

          <p className="mt-3 text-xl text-zinc-800">You haven&apos;t placed any orders yet.</p>

          <p className="mt-4 max-w-md text-sm leading-relaxed text-zinc-600">
            Your wardrobe is waiting for something special.
            <br />
            Explore our embroidered t-shirts and find your new favourites.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/shop"
              className="inline-flex items-center justify-center gap-2.5 bg-black px-7 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-800"
            >
              Shop Now
              <IconArrowRight className="size-4" />
            </Link>
            <Link
              to={tshirtsTo}
              className="inline-flex items-center justify-center border border-zinc-400 bg-white px-7 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-black transition-colors hover:border-black"
            >
              Explore T-Shirts
            </Link>
          </div>
        </div>

        {/* Hidden on phones, where the copy and the two actions are the whole point and the
            illustration would only push them below the fold. */}
        <BagIllustration className="hidden h-auto w-full max-w-[380px] justify-self-center lg:block" />
      </div>

      {/*
        Reassurance strip. `gap-px` over a grey background paints the dividers, so there is
        one rule between cells on desktop and between stacked rows on a phone, without a
        border that doubles up at the ends.
      */}
      <div className="grid gap-px border-t border-zinc-200 bg-zinc-200 sm:grid-cols-3">
        {ASSURANCES.map((item) => (
          <div key={item.title} className="flex items-center gap-3.5 bg-[#f7f7f5] px-6 py-5">
            <item.Icon className="size-7 shrink-0 text-zinc-800" />
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-black">{item.title}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{item.caption}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
