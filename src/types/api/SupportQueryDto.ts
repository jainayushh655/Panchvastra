/**
 * Help Desk contract.
 *
 * VERIFIED LIVE against https://api.panchvastra.com (2026-10-07):
 *   - `POST /v1/support_query/` exists and is PUBLIC (an unauthenticated empty POST returns
 *     400 validation, not 401). `GET` on it returns 405, so it is write-only.
 *   - `GET /v1/support_queries/` exists and is auth-gated (401 unauthenticated).
 *   - Published schema: `CreateSupportQueryRequest` requires name/email/category/message
 *     with maxLength 100 / 254 / — / 2000; `UpdateSupportQueryRequest` requires id + status.
 *   - A 400 returns per-FIELD errors in `message`, keyed by field name:
 *     `{"success":false,"message":{"email":["Enter a valid email address."],
 *       "category":["\"BOGUS\" is not a valid choice."]},"data":{}}`
 *     That object shape is why this feature does not reuse the shared message flatteners —
 *     they join everything into one line, which would lose which input each error belongs to.
 */

/**
 * The six categories, value → label.
 *
 * The VALUE is what the API accepts (confirmed: an unknown value is rejected with
 * `"BOGUS" is not a valid choice.`), and the label is display only — the form must never
 * send the label.
 */
export const SUPPORT_CATEGORIES = [
  { value: 'ORDER_SUPPORT', label: 'Order Support' },
  { value: 'SIZE_PRODUCT', label: 'Size & Product Help' },
  { value: 'COLLABORATION', label: 'Collaborations & Bulk Orders' },
  { value: 'PAYMENT', label: 'Payment Issue' },
  { value: 'WEBSITE', label: 'Website Issue' },
  { value: 'OTHER', label: 'Other' },
] as const

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]['value']

/** The three statuses an admin can set, value → label. */
export const SUPPORT_STATUSES = [
  { value: 'OPEN', label: 'Open' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'RESOLVED', label: 'Resolved' },
] as const

export type SupportStatus = (typeof SUPPORT_STATUSES)[number]['value']

/** Display text for a status the API reports. An unknown value is shown as received. */
export function supportStatusLabel(status: string): string {
  return SUPPORT_STATUSES.find((entry) => entry.value === status)?.label ?? status
}

/** The field names a 400 can carry errors for — the same four the form posts. */
export const SUPPORT_FIELDS = ['name', 'email', 'category', 'message'] as const
export type SupportField = (typeof SUPPORT_FIELDS)[number]

/** Per-field validation messages pulled out of a 400 body. */
export type SupportFieldErrors = Partial<Record<SupportField, string>>

/** Body for `POST /v1/support_query/`. */
export interface CreateSupportQueryDto {
  name: string
  email: string
  category: SupportCategory
  message: string
}

/** Body for `PUT /v1/support_queries/` (admin). Both fields are required. */
export interface UpdateSupportQueryDto {
  id: number
  status: SupportStatus
}

/**
 * One query as the list returns it.
 *
 * `user_id` is nullable — a logged-out visitor can submit the form — so the sender is only
 * linkable when it is present. Fields are optional on top of that so a response missing one
 * degrades to "not shown" rather than rendering `undefined`.
 */
export interface SupportQueryDto {
  id: number
  user_id?: number | null
  name?: string | null
  email?: string | null
  category?: string | null
  /** The backend's own display text for the category badge — never derived client-side. */
  category_label?: string | null
  message?: string | null
  status?: string | null
  created_at?: string | null
  updated_at?: string | null
}

/** The `pagination` block beside `data`, matching this backend's convention elsewhere. */
export interface SupportQueryPaginationDto {
  page?: number | string | null
  page_size?: number | string | null
  total_records?: number | string | null
  total_pages?: number | string | null
  has_next?: boolean | null
  has_previous?: boolean | null
}

/** Query parameters for `GET /v1/support_queries/`, per the published schema. */
export interface SupportQueryParams {
  /** Returns a single query instead of a list. */
  id?: number | string
  page?: number
  page_size?: number
  category?: SupportCategory
  status?: SupportStatus
  /** Matches the sender's name or email. */
  search_parameter?: string
}
