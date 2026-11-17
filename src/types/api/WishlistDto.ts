/**
 * Wishlist contract — `/v1/wishlist/`, signed-in customers only.
 *
 * This replaces the browser-only wishlist the storefront used to keep in `localStorage`
 * under `pv_wishlist_v1_<email>`. There was no endpoint for it before; there is now, so
 * the wishlist follows the account across devices instead of living in one browser.
 */

/** One saved product, as the paginated wishlist page returns it. */
export interface WishlistItemDto {
  /** The PRODUCT id — this is what `?product_id=` takes and what a heart toggles. */
  id: number
  name: string
  primary_image: string | null
  mrp: number
  selling_price: number
  discount_percentage: number
  /** Colour of the variant the card shows. */
  color: string | null
  /** The variant the card's image and price come from. */
  variant_id: number | null
  /** ISO timestamp. The backend returns newest first. */
  added_at: string
}

/**
 * The wishlist's own pagination block.
 *
 * NOTE the key difference from the product/orders blocks: the current page is
 * `current_page` here, not `page`. Confirmed against the documented contract; do not
 * "normalise" it to `page` without checking a live response.
 */
export interface WishlistPaginationDto {
  current_page: number
  page_size: number
  total_pages: number
  total_records: number
  has_next: boolean
  has_previous: boolean
}

/** Body for `POST /v1/wishlist/`. */
export interface WishlistAddDto {
  product_id: number
}
