import type { Metadata } from 'next'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { WishlistView } from '@/components/wishlist/WishlistView'
import { accountPageMetadata } from '@/lib/metadata'

/**
 * `/wishlist` — a Server Component shell around the client wishlist.
 *
 * Guarded exactly as the Vite route is. The saved items live in browser storage scoped to
 * the signed-in email, so there is nothing for the server to read and nothing it could
 * render; see `WishlistView` for why that storage model is unchanged.
 */

export const metadata: Metadata = accountPageMetadata('Wishlist')

function WishlistFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8" role="status" aria-busy="true">
      <span className="sr-only">Loading your saved items</span>
      <div className="h-9 w-40 rounded-sm bg-zinc-200" aria-hidden />
      <div className="mt-6 h-4 w-32 rounded-sm bg-zinc-200" aria-hidden />
    </div>
  )
}

export default function WishlistPage() {
  return (
    <ProtectedRoute fallback={<WishlistFallback />}>
      <WishlistView />
    </ProtectedRoute>
  )
}
