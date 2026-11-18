import { getCategories } from './category'
import { listSubCategories } from './subCategory'
import type { CategoryDto } from '@/types/api/CategoryDto'
import type { SubCategoryDto } from '@/types/api/SubCategoryDto'

/**
 * Shared, de-duplicated reads for the two lists that almost every page needs.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE PROBLEM THIS SOLVES
 * ──────────────────────────────────────────────────────────────────────────────
 * `getCategories()` was being called from four places — the navbar, the footer, the
 * homepage and the shop page. The navbar and footer are both inside `MainLayout`, so they
 * run on EVERY route. Opening the homepage fired three identical requests; opening Shop
 * fired three more. None of them shared a result, and all of them blocked something.
 *
 * Categories change when an admin edits them, which is rare. Re-fetching them several
 * times per navigation is pure waste on a connection that has better things to do.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * HOW IT WORKS
 * ──────────────────────────────────────────────────────────────────────────────
 * The in-flight PROMISE is cached, not just the result. That is the part that matters:
 * the navbar, footer and page all mount in the same tick, so a result cache would still
 * let three requests leave before the first one landed. Sharing the promise collapses
 * them into one.
 *
 * After it resolves the value is held for `TTL_MS`. A failure clears the slot
 * immediately, so an error is retried on the next mount rather than cached as "no
 * categories" for the next five minutes.
 *
 * This is deliberately NOT a general-purpose cache layer. Two lists, both public, both
 * slow-moving, both read on nearly every page. Anything user-specific (cart, wishlist,
 * orders) must never be cached this way — it would leak between accounts on a shared
 * device.
 */

/** Long enough to cover a browsing session, short enough that an admin edit shows up. */
const TTL_MS = 5 * 60 * 1000

type Slot<T> = {
  promise: Promise<T> | null
  /** When the resolved value stops being served. 0 while a request is still in flight. */
  expiresAt: number
}

const categoriesSlot: Slot<CategoryDto[]> = { promise: null, expiresAt: 0 }
const subCategoriesSlot: Slot<SubCategoryDto[]> = { promise: null, expiresAt: 0 }

function read<T>(slot: Slot<T>, fetcher: () => Promise<T>): Promise<T> {
  const now = Date.now()

  // A request already in flight (expiresAt 0), or a fresh result: reuse it.
  if (slot.promise && (slot.expiresAt === 0 || slot.expiresAt > now)) {
    return slot.promise
  }

  const promise = fetcher()
    .then((value) => {
      slot.expiresAt = Date.now() + TTL_MS
      return value
    })
    .catch((error) => {
      // Never cache a failure. The next caller retries instead of inheriting an error,
      // or worse, an empty list that looks like "this shop has no categories".
      slot.promise = null
      slot.expiresAt = 0
      throw error
    })

  slot.promise = promise
  slot.expiresAt = 0
  return promise
}

/** Every category. Shared across the navbar, footer, homepage and shop page. */
export function getCategoriesCached(): Promise<CategoryDto[]> {
  return read(categoriesSlot, () => getCategories())
}

/**
 * Every sub-category, with its `category_id`.
 *
 * Public and unpaginated, verified against the live API. This is what the Shop page's
 * Sub Category filter is built from — see the note there about what it replaced.
 */
export function getSubCategoriesCached(): Promise<SubCategoryDto[]> {
  return read(subCategoriesSlot, () => listSubCategories())
}

/**
 * Drops both caches.
 *
 * For the admin screens: after creating, editing or deleting a category or sub-category,
 * the storefront's copy is stale and the admin is the one person guaranteed to notice.
 */
export function clearCatalogCache(): void {
  categoriesSlot.promise = null
  categoriesSlot.expiresAt = 0
  subCategoriesSlot.promise = null
  subCategoriesSlot.expiresAt = 0
}
