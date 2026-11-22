/**
 * Fallback artwork for a category tile whose backend record carries no `image_url`.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT THE INVESTIGATION FOUND (Phase 4B review point 2)
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite version of this file maps four category slugs to per-category SVGs under
 * `public/images/home-categories/`. Those files are not missing by accident and they are
 * not recoverable-by-oversight: all six of them —
 *
 *     generic-placeholder.svg      hoodies-placeholder.svg
 *     newdrops-placeholder.svg     shorts-placeholder.svg
 *     trackpants-placeholder.svg   tshirts-placeholder.svg
 *
 * — were DELETED on purpose in commit 57270e1 ("Carasol and frontend fixes"). The mapping
 * that points at them was left behind, so the live Vite site has been resolving a
 * category with no image to a 404 ever since.
 *
 * Restoring the deleted art would reverse someone's deliberate decision, and drawing new
 * art would be inventing a design. Neither is a migration. So this uses the fallback the
 * application already has and already trusts for exactly this situation:
 * `/images/no-image.png`, the same asset `productMapper`, `productDetailMapper` and
 * `ProductVariantPicker` fall back to when a product image is missing. It is in
 * `public/images/`, it ships with this app, and one missing-image treatment across
 * products and categories is more coherent than two.
 *
 * The per-slug map is gone with the files it pointed at. Keeping a lookup whose every
 * branch resolved to a 404 would preserve the bug rather than the behaviour.
 */

/** The application's own "this image is missing" asset. Local, so it is optimisable. */
export const MISSING_IMAGE = '/images/no-image.png'

export function categoryPlaceholderImage(): string {
  return MISSING_IMAGE
}
