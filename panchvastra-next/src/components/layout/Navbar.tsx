'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BrandMark } from '@/components/BrandMark'
import { ProfileMenu } from '@/components/layout/ProfileMenu'
import { ShopNavLink, navLinkCls } from '@/components/layout/ShopNavLink'
import { useCart } from '@/context/CartProvider'
import { useWishlist } from '@/context/WishlistProvider'

/**
 * The storefront header.
 *
 * Ported from the Vite `Navbar`. Every class, every SVG path, the three-track grid, the
 * sub-375px rules, both badge styles and the mobile drawer are unchanged — the file is a
 * router substitution, not a redesign.
 *
 *   - `NavLink`/`Link` from react-router -> `next/link`, `to` -> `href`.
 *   - Active styling comes from `usePathname()` instead of NavLink's `isActive`.
 *   - The query-string read that de-activates "Shop" under a category filter moved into
 *     `ShopNavLink`, behind its own Suspense boundary, so this header still renders in
 *     the server HTML. See that file for why.
 *   - The category fetch moved with it: nothing else here needed the list.
 *
 * The two badges count from `CartProvider` and `WishlistProvider`, both of which start
 * empty on the server AND on the first client render, so the counts appear on the paint
 * after the session is restored rather than mismatching the server HTML.
 */
export function Navbar() {
  const { totalItems } = useCart()
  const { count: wishlistCount } = useWishlist()
  const pathname = usePathname()

  const [open, setOpen] = useState(false)

  // The Vite About link has no `end`, so it matches the section, not just the page.
  const aboutActive = pathname === '/about' || pathname.startsWith('/about/')

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-chocolate text-cream">
      {/*
        Three tracks with a centred brand. The side tracks are equal `1fr`s, which is what
        keeps the wordmark optically centred on the full bar — but it also means the right
        cluster (wishlist + cart + account ≈ 106px) is handed the same width as the left
        (a 34px hamburger). Under a ~275px viewport the right cluster no longer fits its
        track and, being `justify-self-end`, spills leftwards over the brand.

        Below 375px — narrower than any real phone, so only reachable through high browser
        zoom — the side tracks become content-sized and the middle absorbs the slack, which
        makes that collision structurally impossible. Gap and padding tighten at the same
        point. From 375px up nothing here applies and the bar is byte-for-byte as it was.
      */}
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-3.5 max-[374px]:grid-cols-[auto_minmax(0,1fr)_auto] max-[374px]:gap-1 max-[374px]:px-2 sm:gap-3 sm:px-4">
        {/* LEFT */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="rounded-md border border-zinc-700 p-1.5 text-cream sm:p-2 md:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((x) => !x)}
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
            <ShopNavLink />
            <Link href="/about" className={navLinkCls(aboutActive)}>
              About Us
            </Link>
          </nav>
        </div>

        {/* CENTER */}
        <div className="flex justify-self-center">
          <BrandMark />
        </div>

        {/* RIGHT */}
        <div className="flex items-center justify-self-end gap-0.5 sm:gap-2.5">
          <Link
            href="/wishlist"
            className="relative rounded-md border border-zinc-700 p-2 text-cream transition-colors hover:border-sand sm:p-2.5"
            aria-label="Wishlist"
          >
            <svg className="size-4 sm:size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                d="M12 20.25s-7.5-4.6-9.75-9.1C.75 7.6 2.6 4.5 6 4.5c2 0 3.5 1 6 3.3 2.5-2.3 4-3.3 6-3.3 3.4 0 5.25 3.1 3.75 6.65-2.25 4.5-9.75 9.1-9.75 9.1z"
              />
            </svg>
            {wishlistCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-black sm:h-[18px] sm:min-w-[18px] sm:text-[10px]">
                {wishlistCount}
              </span>
            ) : null}
          </Link>
          <Link
            href="/cart"
            className="relative rounded-md border border-zinc-700 p-2 text-cream transition-colors hover:border-sand sm:p-2.5"
            aria-label="Cart"
          >
            <svg className="size-4 sm:size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
            </svg>
            {totalItems > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-black sm:h-[18px] sm:min-w-[18px] sm:text-[10px]">
                {totalItems}
              </span>
            ) : null}
          </Link>
          <ProfileMenu />
        </div>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="border-t border-zinc-800 px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            <Link
              href="/shop"
              className="rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-cream hover:bg-sand/15"
              onClick={() => setOpen(false)}
            >
              Shop
            </Link>
            <Link
              href="/about"
              className="rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-cream hover:bg-sand/15"
              onClick={() => setOpen(false)}
            >
              About Us
            </Link>
            <Link
              href="/help-desk"
              className="rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-cream hover:bg-sand/15"
              onClick={() => setOpen(false)}
            >
              Help Desk
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
