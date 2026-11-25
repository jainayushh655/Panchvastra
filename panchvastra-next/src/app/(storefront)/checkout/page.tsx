import type { Metadata } from 'next'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { CheckoutView } from '@/components/checkout/CheckoutView'
import { AddressProvider } from '@/context/AddressProvider'
import { accountPageMetadata } from '@/lib/metadata'

/**
 * `/checkout` — a Server Component shell around the review step.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * NOTHING CUSTOMER-SPECIFIC IS FETCHED OR CACHED ON THE SERVER
 * ──────────────────────────────────────────────────────────────────────────────
 * The cart, the saved addresses and any coupon are all read in the browser, against the
 * signed-in customer's own token. That is not a limitation worked around here, it is the
 * correct arrangement for this page: a cart and a payable amount are specific to one
 * person and one moment, and must never sit in a shared server cache or in prerendered
 * HTML. The server renders the signed-out shell and nothing else.
 *
 * `ProtectedRoute` reproduces the Vite route guard — `/checkout` sits inside
 * `<ProtectedRoute>` there — and carries the return path, so a signed-out visitor lands
 * on `/login?next=%2Fcheckout` and comes back here.
 *
 * `AddressProvider` is mounted HERE rather than globally, exactly as on `/profile`: this
 * is one of the two screens that actually reads the address book, and mounting it inside
 * the guard means a signed-out visitor never triggers the request at all.
 *
 * `noindex, nofollow` is permanent here: a checkout is reachable only with a cart and has
 * nothing to offer a search result.
 */

export const metadata: Metadata = accountPageMetadata('Checkout', { follow: false })

/** Matches the page's own heading block, so the guard does not collapse the layout. */
function CheckoutFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8" role="status" aria-busy="true">
      <span className="sr-only">Loading checkout</span>
      <div className="h-9 w-40 rounded-sm bg-zinc-200" aria-hidden />
      <div className="mt-6 h-4 w-72 max-w-full rounded-sm bg-zinc-200" aria-hidden />
      <div className="mt-8 h-64 rounded-sm bg-zinc-100" aria-hidden />
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <ProtectedRoute fallback={<CheckoutFallback />}>
      <AddressProvider>
        <CheckoutView />
      </AddressProvider>
    </ProtectedRoute>
  )
}
