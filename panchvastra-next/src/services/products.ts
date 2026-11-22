/**
 * Browser-side product reads.
 *
 * ⚠️ There is deliberately ONE of these: the Shop page's infinite scroll. Page 1 of every
 * Shop query, and the whole product detail page, are read on the SERVER
 * (`services/server/catalog.ts`) so they land in the HTML. This exists because "the
 * shopper scrolled to the bottom" is an interaction, not a navigation — turning it into
 * one would push a new URL and re-render the page for every 20 products.
 *
 * The request is identical to the server's: same path from `ENDPOINTS`, same parameters
 * built by the same `resolveShopSelection`, just issued by the shared axios client so it
 * carries the interceptors every other browser call does.
 */

import api from '@/services/http/client'
import { ENDPOINTS } from '@/services/endpoints'
import { readApiMessageWithFields } from '@/services/http/apiMessage'
import type { Pagination } from '@/services/http/pagination'
import type { ProductDto } from '@/types/api/ProductDto'
import type { ProductQueryParams } from '@/types/api/ProductQuery'

type ProductListResponse = {
  success?: boolean
  message?: unknown
  data?: ProductDto[]
  pagination?: Pagination
}

/** One page of the list endpoint, with the paging metadata the caller needs. */
export type ProductListPage = {
  products: ProductDto[]
  /** null when the response carried no `pagination` block — never fabricated. */
  pagination: Pagination | null
}

export async function getProductsPageList(params: ProductQueryParams = {}): Promise<ProductListPage> {
  const response = await api.get<ProductListResponse>(
    ENDPOINTS.products,
    Object.keys(params).length ? { params } : undefined,
  )

  return {
    products: Array.isArray(response.data?.data) ? response.data.data : [],
    pagination: response.data?.pagination ?? null,
  }
}

/**
 * Turns a thrown request error into a message that is safe to show a shopper.
 *
 * The status table is the Vite `readProductApiError`, minus its admin-session branches —
 * this is a storefront read and there is no admin session in play. 5xx bodies on this
 * backend can carry a Django debug page or raw SQL, so they are never surfaced.
 */
export function readProductApiError(error: unknown, fallback: string): string {
  const response = (error as { response?: { status?: number; data?: { message?: unknown } } }).response
  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const status = response.status
  if (status === 404) return 'That product could not be found.'
  if (status === 429) return 'Too many requests. Please try again in a moment.'
  if (status && status >= 500) return 'The server is temporarily unavailable. Please try again shortly.'

  return readApiMessageWithFields(response.data?.message, fallback)
}
