import type { Metadata } from 'next'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ProfileView } from '@/components/account/ProfileView'
import { AddressProvider } from '@/context/AddressProvider'
import { accountPageMetadata } from '@/lib/metadata'

/**
 * `/profile` — the customer account page.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY `AddressProvider` IS MOUNTED HERE AND NOT IN THE GLOBAL STACK
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite app mounts it in `main.tsx`, beside the toast, auth, cart and wishlist
 * providers — so `GET /v1/address_management/` fires for every signed-in visitor on every
 * page, including the homepage, the shop and every product page, none of which read an
 * address. Phase 3 deliberately left it out of the global stack for that reason.
 *
 * Mounting it on the one page that uses it keeps the context and its API exactly as they
 * are while making the request happen only where the data is shown. Checkout mounts it
 * the same way when it is migrated; two pages each loading their own addresses is still
 * strictly fewer requests than every page loading them.
 *
 * It sits INSIDE `ProtectedRoute`, so a signed-out visitor never mounts it at all and no
 * address request is made before there is a session to make it with.
 */

export const metadata: Metadata = accountPageMetadata('My Profile')

function ProfileFallback() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10" role="status" aria-busy="true">
      <span className="sr-only">Loading your account</span>
      <div className="h-3 w-16 rounded-sm bg-zinc-200" aria-hidden />
      <div className="mt-3 h-9 w-48 rounded-sm bg-zinc-200" aria-hidden />
      <div className="mt-8 h-64 rounded-sm bg-zinc-100" aria-hidden />
    </div>
  )
}

export default function ProfilePage() {
  return (
    <ProtectedRoute fallback={<ProfileFallback />}>
      <AddressProvider>
        <ProfileView />
      </AddressProvider>
    </ProtectedRoute>
  )
}
