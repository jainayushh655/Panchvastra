/**
 * Query contract for GET /v1/products_management/.
 *
 * Transcribed from the Vite application's `src/api/product.ts`, where each of these was
 * verified against the live backend. Nothing here is inferred, and nothing is new.
 */

/** Backend-supported values for `sort_by`. `latest` is the backend's own default. */
export type ProductSortBy =
  | 'latest'
  | 'oldest'
  | 'price_low_to_high'
  | 'price_high_to_low'
  | 'display_order'

/**
 * Verified-real server-side filters. Price filtering is NOT supported server-side, so
 * that stays client-side wherever it is needed.
 */
export interface ProductQueryParams {
  category_id?: number
  sub_category_id?: number
  size?: string
  search?: string
  sort_by?: ProductSortBy
  /**
   * 1-based page. Omitting it gets the backend's first page.
   *
   * The list endpoint has always paginated at a default `page_size` of 20 and reported
   * `has_next`; a caller that never sends `page` silently sees only the first page.
   */
  page?: number
  /** Rows per page. Omitting it uses the backend's default of 20. */
  page_size?: number
}
