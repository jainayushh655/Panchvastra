/**
 * Notify-Me contract for /v1/notify_me/.
 *
 * VERIFIED LIVE (see `src/api/notifyMe.ts` for the full probe log) and against the
 * backend's published OpenAPI schema (GET /api/schema/, tag "Notify Me").
 */

/** Request body for POST /v1/notify_me/ — both fields are required by the backend. */
export interface NotifyMeCreateDto {
  variant_size_id: number
  email: string
}

/**
 * A pending subscription as returned by GET /v1/notify_me/.
 *
 * NOT VERIFIED: the GET currently fails server-side (see `notifyMe.ts`), so the payload
 * could not be observed. Fields are optional and read defensively; `id` is the value the
 * DELETE endpoint expects as its `id` query parameter — the subscription id, never a
 * product, variant or variant-size id.
 */
export interface NotifyMeSubscriptionDto {
  id?: number | string | null
  variant_size_id?: number | string | null
  email?: string | null
  [key: string]: unknown
}

/** Query parameters accepted by GET /v1/notify_me/, per the published schema. */
export interface NotifyMeQuery {
  page?: number
  page_size?: number
  variant_size_id?: number
}

/**
 * One waitlist row from GET /v1/notify_me/ — the CONFIRMED admin response.
 *
 * The backend already joins the product, variant and size, so every column the admin needs
 * is present here and no catalogue lookup is performed anywhere on the client.
 *
 * `size_id` and `variant_size_id` are the same size identifier in this schema, not two
 * different entities; `id` is the waitlist row's own id and the value DELETE expects.
 */
export interface AdminNotifyMeRequestDto {
  id: number
  email: string
  variant_size_id: number
  size_id: number
  product_id: number
  product_name: string
  variant_id: number
  color: string
  size: string
  stock_quantity: number
  user_id: number
  created_at: string
  is_notified: boolean
}

/** The pagination block returned alongside the waitlist rows. */
export interface NotifyMePagination {
  current_page: number
  page_size: number
  total_pages: number
  total_records: number
  has_next: boolean
  has_previous: boolean
}

/** Envelope for the admin list read. */
export interface AdminNotifyMeListResponse {
  success?: boolean
  message?: string | Record<string, string[]>
  data?: AdminNotifyMeRequestDto[]
  pagination?: NotifyMePagination
}
