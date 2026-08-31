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
