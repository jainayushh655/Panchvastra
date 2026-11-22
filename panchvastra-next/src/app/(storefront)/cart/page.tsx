import type { Metadata } from 'next'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { CartView } from '@/components/cart/CartView'
import { accountPageMetadata } from '@/lib/metadata'

/**
 * `/cart` — a Server Component shell around the client cart.
 *
 * The shell is all that CAN be server-rendered here, and that is the point of keeping it:
 * the metadata and the page's place in the route tree are resolved on the server, while
 * the only parts that need the browser — the session and the cart itself — stay in one
 * island below. Nothing on this page is fetched on the server, because everything on it
 * is specific to one signed-in shopper and the server cannot see their session until the
 * Phase 5 cookie bridge.
 *
 * `ProtectedRoute` reproduces the Vite route guard, including the return path; see that
 * component for why the check is in the browser.
 */

export const metadata: Metadata = accountPageMetadata('Cart')

/** Matches the page's own heading block, so the guard does not collapse the layout. */
function CartFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8" role="status" aria-busy="true">
      <span className="sr-only">Loading your cart</span>
      <div className="h-9 w-32 rounded-sm bg-zinc-200" aria-hidden />
      <div className="mt-6 h-4 w-40 rounded-sm bg-zinc-200" aria-hidden />
    </div>
  )
}

export default function CartPage() {
  return (
    <ProtectedRoute fallback={<CartFallback />}>
      <CartView />
    </ProtectedRoute>
  )
}
