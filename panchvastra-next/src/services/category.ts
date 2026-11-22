/**
 * Categories — READ side only.
 *
 * Ported from the Vite application's `src/api/category.ts`. The GET contract is
 * byte-for-byte what that module sends today: `GET /v1/categories_management/` with the
 * optional `id` / `page` / `page_size` / `search_parameter` parameters, returning
 * `response.data.data` — the bare array — so the Navbar and Footer call it with no
 * arguments and receive exactly what they received before.
 *
 * WHAT IS DELIBERATELY ABSENT. `createCategory`, `updateCategory`, `deleteCategory` and
 * the admin error readers are not here. They are admin-only, multipart, and depend on
 * `adminAuthConfig`; they move with the admin panel in Phase 5. Phase 3 needs the list
 * and nothing else, and porting the writes early would mean admin surface in the bundle
 * of every storefront page.
 *
 * The read stays unauthenticated-by-default — it goes through the shared client, whose
 * interceptor attaches the shopper's token when there is one, exactly as in the Vite app.
 */

import api from '@/services/http/client'
import { ENDPOINTS } from '@/services/endpoints'
import type { CategoryDto, CategoryListResponse, CategoryQuery } from '@/types/api/CategoryDto'

/** Drops empty values so only parameters the caller actually set are sent. */
function toParams(query: CategoryQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {}
  if (query.id !== undefined) params.id = query.id
  if (query.page !== undefined) params.page = query.page
  if (query.page_size !== undefined) params.page_size = query.page_size
  if (query.search_parameter?.trim()) params.search_parameter = query.search_parameter.trim()
  return params
}

/**
 * GET /v1/categories_management/ — the category list.
 *
 * Returns the array. A caller that needs the pagination block uses `getCategoriesPage`.
 */
export async function getCategories(query: CategoryQuery = {}): Promise<CategoryDto[]> {
  const response = await api.get<CategoryListResponse>(ENDPOINTS.categories, {
    params: toParams(query),
  })

  return Array.isArray(response.data?.data) ? response.data.data : []
}

/** The same request, returning the pagination block alongside the rows. */
export async function getCategoriesPage(query: CategoryQuery = {}) {
  const response = await api.get<CategoryListResponse>(ENDPOINTS.categories, {
    params: toParams(query),
  })

  return {
    data: Array.isArray(response.data?.data) ? response.data.data : [],
    pagination: response.data?.pagination,
  }
}

export type { CategoryDto }
