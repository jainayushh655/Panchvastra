/**
 * Pagination and query-parameter conventions.
 *
 * The `pagination` block's field names were VERIFIED LIVE against
 * `GET /v1/products_management/` on 2026-10-05 by the Vite application:
 *
 *     { "page": 1, "page_size": 20, "total_records": 21, "total_pages": 2,
 *       "has_next": true, "has_previous": false }
 *
 * The current page is `page`. An earlier version of the Vite interface declared
 * `current_page`, which the backend has never sent — nothing read it, so nothing broke,
 * but it is a reminder not to invent field names here.
 *
 * The same block shape is returned by the orders, support-queries and custom-requests
 * list endpoints.
 */

/** The `pagination` block the list endpoints return beside `data`. */
export interface Pagination {
  page: number
  page_size: number
  total_pages: number
  total_records: number
  has_next: boolean
  has_previous: boolean
}

/** The backend's own default page size. Matching it keeps the first screenful identical. */
export const DEFAULT_PAGE_SIZE = 20

/**
 * One page of a list endpoint, with the paging metadata the caller needs.
 *
 * `pagination` is `null` when the response carried no block — **never fabricated**. Code
 * that pages must stop on `has_next !== true`, so an absent block ends paging rather than
 * looping forever against a backend that stopped reporting it.
 */
export interface Page<T> {
  items: T[]
  pagination: Pagination | null
}

/** Reads the envelope's `data` array defensively — a non-array becomes an empty page. */
export function readPage<T>(body: { data?: unknown; pagination?: unknown } | undefined): Page<T> {
  return {
    items: Array.isArray(body?.data) ? (body.data as T[]) : [],
    pagination: isPagination(body?.pagination) ? body.pagination : null,
  }
}

function isPagination(value: unknown): value is Pagination {
  if (!value || typeof value !== 'object') return false
  const block = value as Partial<Pagination>
  return typeof block.page === 'number' && typeof block.has_next === 'boolean'
}

/**
 * Whether there is another page, read strictly from the response's own `has_next`.
 *
 * Nothing is inferred from `total_records` or from the number of rows returned: those
 * disagree with `has_next` whenever a record is soft-deleted between requests, and the
 * backend's own flag is the only safe signal.
 */
export function hasNextPage(pagination: Pagination | null): boolean {
  return pagination?.has_next === true
}

/**
 * Drops empty values so only parameters the caller actually set reach the wire.
 *
 * This is the convention every Vite service's own `toParams` implements, and it matters:
 * this backend treats an explicitly-sent empty `search=` differently from an absent one
 * on some endpoints, and sending `page_size=undefined` serialises as the literal string
 * "undefined".
 *
 * Kept, in order: a number (including `0`), a boolean, and a non-blank trimmed string.
 * Dropped: `undefined`, `null`, `''`, whitespace-only, and `NaN`.
 */
export function toQueryParams(
  query: Record<string, string | number | boolean | null | undefined>,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {}

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue

    if (typeof value === 'number') {
      if (Number.isFinite(value)) params[key] = value
      continue
    }

    if (typeof value === 'boolean') {
      params[key] = value
      continue
    }

    const trimmed = value.trim()
    if (trimmed) params[key] = trimmed
  }

  return params
}
