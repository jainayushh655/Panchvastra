import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'

/**
 * The storefront layout — the Next.js equivalent of the Vite app's `MainLayout`.
 *
 * `(storefront)` is a ROUTE GROUP: the parentheses keep it out of the URL, so a page at
 * `app/(storefront)/shop/page.tsx` still answers on `/shop`. Every customer-facing page
 * migrated in Phase 4 goes inside this folder and inherits this chrome; `/admin` will sit
 * outside it with its own layout, so admin CSS and the admin provider never load for a
 * shopper.
 *
 * Structurally it is the Vite `MainLayout`, one for one:
 *
 *     <div className="flex min-h-svh flex-col">   same wrapper, same classes
 *       <Navbar />                                same component
 *       <main className="flex-1">{children}</main>  `<Outlet />` -> `children`
 *       <Footer />                                same component
 *     </div>
 *
 * This file stays a SERVER COMPONENT. It touches no browser API, so the chrome is in the
 * server HTML and only `Navbar`/`Footer` — which need state, storage-derived counts and
 * the category list — are client islands.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE ONE THING THAT IS NOT PORTED, AND WHY
 * ──────────────────────────────────────────────────────────────────────────────
 * `MainLayout` scrolls to the top on every navigation:
 *
 *     useLayoutEffect(() => { window.scrollTo(0, 0) }, [pathname, search])
 *
 * React Router does not restore scroll on its own, so that effect was doing the browser's
 * job for it. The Next App Router already scrolls to the top of the page on every
 * navigation — including query-only ones — and restores the previous position on back and
 * forward, which the Vite version could not. Re-implementing the effect here would mean
 * reading `useSearchParams()` in the layout, which would force the entire storefront to
 * render on the client, and it would also defeat scroll restoration on the back button.
 *
 * A Phase 4 page that deliberately wants to preserve position for an in-page filter opts
 * out per link with `scroll={false}`, which is the idiomatic control for exactly this.
 */
export default function StorefrontLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
