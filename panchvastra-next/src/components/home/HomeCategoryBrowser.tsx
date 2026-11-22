'use client'

import { useState, type ReactNode } from 'react'
import { HomeCategoryFilters } from '@/components/home/HomeCategoryFilters'
import { HomeProductGrid } from '@/components/home/HomeProductGrid'
import { categoryNameToSlug } from '@/lib/categorySlug'
import type { CategoryDto } from '@/types/api/CategoryDto'
import type { Product } from '@/types'

/**
 * The pills and the grid they filter — the ONLY interactive part of the homepage below
 * the hero, and therefore the only part that is a Client Component.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT MOVED HERE FROM THE VITE `HomePage`
 * ──────────────────────────────────────────────────────────────────────────────
 * In the Vite app the selected category lives in `HomePage`, alongside the data fetching,
 * so the whole page is a client component. Here the page is a Server Component and the
 * only thing that genuinely needs state — which pill is pressed — is isolated in this one
 * island. The rest of the homepage (hero copy aside) ships no component JavaScript.
 *
 * The filtering rule is unchanged: the grid shows up to 8 products whose `categorySlug`
 * matches the active pill. What changed is WHERE the filtering happens. The page
 * pre-groups products by category slug on the server and passes the groups, already
 * capped at 8, so:
 *
 *   - switching a pill is a lookup, not a scan;
 *   - the payload carries only the products the grid can actually display, instead of the
 *     whole catalogue being serialised into the HTML for a client-side `.filter()`.
 *
 * The Vite expression `products.filter(p => p.categorySlug === active).slice(0, 8)` and
 * `productsByCategory[active]` return the same list in the same order, because the groups
 * are built by walking the same server-ordered array.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE DEFAULT-CATEGORY FALLBACK, WITHOUT THE EFFECT
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite page keeps the selection honest with an effect: if nothing is selected, or the
 * selected category stops having products, it falls back to the first available one. That
 * effect existed because the category list arrives asynchronously, AFTER the first render.
 *
 * Here the list is known before this component mounts, so the same guarantee is a plain
 * expression during render: an active slug that is not in the available list resolves to
 * the first one. No effect, no extra render, no window where the grid is empty because the
 * default has not been applied yet.
 */
export function HomeCategoryBrowser({
  categories,
  productsByCategory,
  initialCategory,
  customStudio,
}: {
  /** Already filtered to categories that have products — the Vite `availableCategories`. */
  categories: CategoryDto[]
  /** Category slug -> up to 8 products, in the backend's curated order. */
  productsByCategory: Record<string, Product[]>
  /** The first available category's slug, resolved on the server. */
  initialCategory: string
  /** Server-rendered "The Custom Studio" banner, passed straight through. */
  customStudio?: ReactNode
}) {
  const [selected, setSelected] = useState(initialCategory)

  const slugs = categories.map((category) => categoryNameToSlug(category.name))
  // Same rule as the Vite effect: keep the selection only while it is still available.
  const active = selected && slugs.includes(selected) ? selected : (slugs[0] ?? '')

  return (
    <div className="bg-white">
      <HomeCategoryFilters categories={categories} active={active} onChange={setSelected} />
      <HomeProductGrid products={active ? (productsByCategory[active] ?? []) : []} customStudio={customStudio} />
    </div>
  )
}
