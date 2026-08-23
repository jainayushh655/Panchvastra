/**
 * Canonical category/subcategory name → URL slug used across the homepage,
 * Footer, and Shop page. Single source of truth so a homepage tile link and
 * the Shop page's own filtering always agree on the same slug for the same
 * real backend category — no guessing, no drift.
 */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * "T-Shirts" → "regular-tee" and "Shorts" → "shorts" are the site's existing,
 * already-linked convention (Footer, defaultHomepage featured tiles). Any
 * other real backend category slugifies generically instead of being lumped
 * into "regular-tee" (the previous bug).
 */
export function categoryNameToSlug(name: string): string {
  const n = name.trim().toLowerCase()
  if (n === 't-shirts' || n === 'tshirts' || n === 't shirts') return 'regular-tee'
  if (n === 'shorts') return 'shorts'
  return slugify(name)
}

export function subCategoryNameToSlug(name: string): string {
  return slugify(name)
}
