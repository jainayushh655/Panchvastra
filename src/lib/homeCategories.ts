/**
 * Homepage category-image mapping.
 *
 * Category NAMES, IDs, and destinations are no longer sourced here — they
 * come straight from `getCategories()` (see `HomeCategoryGrid`/`HomePage`).
 * This file only maps a real backend category's slug to a local placeholder
 * image when the category has no `image_url` from the API, so the mapping
 * is `backend category slug → local placeholder` rather than a hardcoded
 * category name → tile. Swap the SVG files to replace the art later; add a
 * new slug key here as real categories are added on the backend.
 */

const CATEGORY_PLACEHOLDER_IMAGE_BY_SLUG: Record<string, string> = {
  hoodies: '/images/home-categories/hoodies-placeholder.svg',
  'regular-tee': '/images/home-categories/tshirts-placeholder.svg',
  'track-pants': '/images/home-categories/trackpants-placeholder.svg',
  shorts: '/images/home-categories/shorts-placeholder.svg',
}

const DEFAULT_CATEGORY_PLACEHOLDER_IMAGE = '/images/home-categories/generic-placeholder.svg'

export function categoryPlaceholderImage(slug: string): string {
  return CATEGORY_PLACEHOLDER_IMAGE_BY_SLUG[slug] ?? DEFAULT_CATEGORY_PLACEHOLDER_IMAGE
}

/**
 * "New Drops" is not a backend category — it reuses the existing
 * new-arrival sort mechanism already used by the Footer's "New Arrivals"
 * link (`/shop?sort=new-arrival`), per the product's existing `isNew`
 * field. Kept as a fixed tile appended after the real category tiles.
 */
export const NEW_DROPS_TILE = {
  label: 'New Drops',
  to: '/shop?sort=new-arrival',
  image: '/images/home-categories/newdrops-placeholder.svg',
}
