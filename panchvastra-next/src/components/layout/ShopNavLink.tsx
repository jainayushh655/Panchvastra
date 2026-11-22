'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { getCategories } from '@/services/category'
import type { CategoryDto } from '@/types/api/CategoryDto'

/**
 * The navbar's "Shop" link, and the one place in the chrome that reads the query string.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT IT REPRODUCES
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite navbar renders Shop as `<NavLink to="/shop" end>` and then DE-activates it
 * when a category filter is applied:
 *
 *     const activeCategorySlug = searchParams.get('category')
 *     const categoryFilterActive = Boolean(
 *       activeCategorySlug && categories.some((c) => c.name.toLowerCase() === activeCategorySlug),
 *     )
 *
 * so browsing `/shop?category=hoodie` does not light up the plain "Shop" entry. The
 * comparison is `name.toLowerCase()`, NOT `categoryNameToSlug`, and it is kept exactly
 * that way here: changing it would change which links highlight for any category whose
 * name contains a space.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY IT IS ITS OWN COMPONENT BEHIND A SUSPENSE BOUNDARY
 * ──────────────────────────────────────────────────────────────────────────────
 * `useSearchParams()` makes the client component tree up to the nearest Suspense boundary
 * client-rendered on a statically-rendered route. Calling it directly in `Navbar` would
 * therefore drop the ENTIRE header — wordmark, nav, cart, account — out of the server
 * HTML and paint it only after JavaScript arrives. Isolating it here keeps the boundary
 * one link wide.
 *
 * The fallback is the same link with no filter applied, which is byte-for-byte what the
 * query-aware version renders for every URL without a `?category=`: that is the large
 * majority of pages, so the server HTML is usually already final.
 *
 * Categories are fetched in an effect, exactly as the Vite navbar does — a client-side
 * request, so nothing is called during `next build`. A failed request leaves the list
 * empty, which just means the filter never de-activates the link; the header must never
 * break over decoration.
 */

export function navLinkCls(isActive: boolean): string {
  return `text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:text-cream ${
    isActive ? 'text-cream' : 'text-sand'
  }`
}

function ShopLink({ categoryFilterActive }: { categoryFilterActive: boolean }) {
  const pathname = usePathname()
  // `end` in the Vite NavLink: an exact match on /shop, never a prefix match.
  const isActive = pathname === '/shop'

  return (
    <Link href="/shop" className={navLinkCls(isActive && !categoryFilterActive)}>
      Shop
    </Link>
  )
}

function ShopLinkWithCategoryFilter() {
  const searchParams = useSearchParams()
  const [categories, setCategories] = useState<CategoryDto[]>([])

  useEffect(() => {
    let active = true

    getCategories()
      .then((data) => {
        if (active) setCategories(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        // Decorative state only: the header must never break a page it sits above.
        if (active) setCategories([])
      })

    return () => {
      active = false
    }
  }, [])

  const activeCategorySlug = searchParams.get('category')
  const categoryFilterActive = Boolean(
    activeCategorySlug && categories.some((c) => c.name.toLowerCase() === activeCategorySlug),
  )

  return <ShopLink categoryFilterActive={categoryFilterActive} />
}

export function ShopNavLink() {
  return (
    <Suspense fallback={<ShopLink categoryFilterActive={false} />}>
      <ShopLinkWithCategoryFilter />
    </Suspense>
  )
}
