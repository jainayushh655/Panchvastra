import { Link } from 'react-router-dom'

/**
 * The Orders page when the customer has never ordered.
 *
 * Deliberately plain: an icon, a line, a supporting line, one way forward. It mirrors the
 * Cart and Wishlist empty states exactly — same bag mark, same type scale, same black CTA
 * with a trailing arrow — so the three "nothing here yet" screens read as one family
 * rather than three different ideas.
 *
 * Shown ONLY for a genuinely empty account. A filter that happens to match nothing keeps
 * the normal list view and its own message, because "you haven't placed any orders yet"
 * would be untrue there.
 */

function IconBag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      {/* Tote body, with the handle arcing above its top edge. Drawn to fill the viewBox
          so the mark reads at the size the reference uses rather than floating small
          inside its own box. */}
      <path
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M3.6 8.6h16.8v11.6a2 2 0 0 1-2 2H5.6a2 2 0 0 1-2-2z"
      />
      <path strokeLinecap="round" strokeWidth={1.6} d="M8.4 8.6a3.6 3.6 0 0 1 7.2 0" />
    </svg>
  )
}

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16m0 0-6-6m6 6-6 6" />
    </svg>
  )
}

export function EmptyOrders() {
  return (
    /*
     * `min-h` balances the block between the page title and the footer while leaving the
     * footer in normal page flow — the same approach the Cart and Wishlist empty states use.
     */
    <div className="flex min-h-[48vh] flex-col items-center justify-center px-4 py-12 text-center">
      <IconBag className="size-14 text-zinc-900" />

      <h2 className="mt-5 text-2xl font-bold tracking-tight text-black sm:text-3xl">
        You haven&rsquo;t placed any orders yet.
      </h2>

      <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">
        Your next favourite piece is waiting.
      </p>

      <Link
        to="/shop"
        className="mt-7 inline-flex items-center justify-center gap-2 bg-black px-7 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-800"
      >
        Explore the collection
        <IconArrowRight className="size-4" />
      </Link>
    </div>
  )
}
