import type { Metadata } from 'next'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { OrdersView } from '@/components/account/OrdersView'
import { accountPageMetadata } from '@/lib/metadata'

/**
 * `/orders` — order history and per-order detail.
 *
 * Deliberately does NOT mount `AddressProvider`: an order carries its own shipping
 * address in its own payload, so the address book is not needed here and fetching it
 * would be a request for data this page never reads.
 */

export const metadata: Metadata = accountPageMetadata('My Orders')

function OrdersFallback() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10" role="status" aria-busy="true">
      <span className="sr-only">Loading your orders</span>
      <div className="h-9 w-44 rounded-sm bg-zinc-200" aria-hidden />
      <div className="mt-6 h-40 rounded-sm bg-zinc-100" aria-hidden />
    </div>
  )
}

export default function OrdersPage() {
  return (
    <ProtectedRoute fallback={<OrdersFallback />}>
      <OrdersView />
    </ProtectedRoute>
  )
}
