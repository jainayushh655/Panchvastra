'use client'

import { AuthProvider } from '@/context/AuthProvider'
import { CartProvider } from '@/context/CartProvider'
import { ToastProvider } from '@/context/ToastProvider'
import { WishlistProvider } from '@/context/WishlistProvider'

/**
 * The single Client Component boundary for the whole application.
 *
 * Everything above this in the tree — the root layout, the storefront layout, every page
 * that does not opt in — stays a Server Component. Putting the providers in one file keeps
 * that boundary explicit and in one place, instead of scattering `'use client'` through
 * the layouts.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE NESTING ORDER
 * ──────────────────────────────────────────────────────────────────────────────
 * This is the order the Vite app's `main.tsx` uses, and the order is not arbitrary — each
 * provider consumes the one above it:
 *
 *     ToastProvider          (no dependencies)
 *       AuthProvider         (owns the session; everything below reads `token`)
 *         CartProvider       (re-fetches the server cart whenever `token` changes)
 *           WishlistProvider (scopes its localStorage key by the signed-in email)
 *
 * `AddressProvider` is the fifth in the Vite stack and is deliberately NOT here: its only
 * consumers are the checkout and profile screens, which are Phase 4. Mounting it now would
 * fire `GET /v1/address_management/` on every storefront page for a signed-in visitor,
 * including pages that never read an address. It is ported with the screens that use it.
 *
 * `AdminAuthProvider` is not part of this stack either: it belongs in `app/admin/layout.tsx`
 * so the admin CSS and its provider never load for a shopper.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * HYDRATION
 * ──────────────────────────────────────────────────────────────────────────────
 * None of these providers reads `localStorage` during render. `AuthProvider` restores the
 * stored session in an effect after mount, and `WishlistProvider` keys its state by the
 * email that session produces, so the server HTML and the first client render agree on the
 * signed-out, empty-cart, empty-wishlist view. See `AuthProvider` and `WishlistProvider`
 * for the full reasoning, including the stored-wishlist overwrite that the keyed state
 * exists to prevent.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <CartProvider>
          <WishlistProvider>{children}</WishlistProvider>
        </CartProvider>
      </AuthProvider>
    </ToastProvider>
  )
}
