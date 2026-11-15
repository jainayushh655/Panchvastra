'use client'

import { ToastProvider } from '@/context/ToastProvider'

/**
 * The single Client Component boundary for the whole application.
 *
 * Everything above this in the tree — the root layout, every page that does not opt in —
 * stays a Server Component. Putting the providers in one file keeps that boundary
 * explicit and in one place, instead of scattering `'use client'` through the layout.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE TARGET NESTING ORDER
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite app's `main.tsx` nests the providers in this order, and the order is not
 * arbitrary — each one consumes the one above it:
 *
 *     ToastProvider          (no dependencies)
 *       AuthProvider         (owns the session; everything below reads `token`)
 *         CartProvider       (re-fetches the server cart whenever `token` changes)
 *           WishlistProvider (scopes its localStorage key by the signed-in email)
 *             AddressProvider(re-fetches the address book whenever `token` changes)
 *
 * Phase 2 ships only `ToastProvider`: it is self-contained, has no auth dependency and
 * nothing to hydrate, so it can land now without touching authentication. The remaining
 * four arrive in Phase 3, inserted at the marked position in exactly that order.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE HYDRATION RULE FOR THE PROVIDERS STILL TO COME
 * ──────────────────────────────────────────────────────────────────────────────
 * `AuthProvider` and `WishlistProvider` currently seed their initial state straight from
 * `localStorage` inside a `useState` initialiser:
 *
 *     const [user, setUser] = useState(() => readStoredSession().user)   // Vite
 *
 * That cannot be ported as-is. The server renders with no storage, so the first client
 * render would disagree with the server HTML and React would discard it — producing a
 * wrong first paint (signed-out chrome for a signed-in user, an empty wishlist badge)
 * rather than a crash, which is what makes it easy to miss. The migration audit rated
 * this the single most likely hydration failure.
 *
 * The fix, applied when those providers are ported: start from the EMPTY state that the
 * server also renders, then load from storage in an effect, and gate anything
 * storage-derived on `useHydrated()` (see `@/hooks/useHydrated`).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      {/*
        Phase 3 inserts, in this order:
          <AuthProvider>
            <CartProvider>
              <WishlistProvider>
                <AddressProvider>
        ...wrapping {children}. AdminAuthProvider is NOT part of this stack: it lives in
        `app/admin/layout.tsx` so the admin CSS and its provider never load for a shopper.
      */}
      {children}
    </ToastProvider>
  )
}
