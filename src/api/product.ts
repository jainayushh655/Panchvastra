import api from "./axios";
import { adminAuthConfig, MissingAdminSessionError } from "./adminRequest";

import type { ProductDto } from "@/types/api/ProductDto";
import type { ProductDetailDto } from "@/types/api/ProductDetailDto";
import type {
  ProductAdminQuery,
  ProductCreateDto,
  ProductUpdateDto,
} from "@/types/api/ProductWriteDto";

export { MissingAdminSessionError };

type ProductEnvelope = {
  success?: boolean;
  message?: string | Record<string, string[]>;
  data?: unknown;
};

export interface ProductPagination {
  current_page: number;
  page_size: number;
  total_pages: number;
  total_records: number;
  has_next: boolean;
  has_previous: boolean;
}

interface ProductListResponse {
  success: boolean;
  message: string;
  data: ProductDto[];
}

interface ProductDetailResponse {
  success: boolean;
  message: string;
  data: ProductDetailDto;
}

/**
 * Verified-real server-side filters on `/v1/products_management/` (confirmed
 * against the live backend — see category_id/sub_category_id SQL error leak,
 * and empty-vs-nonempty diffing for size/search). Price and sort are NOT
 * supported server-side (params are silently ignored), so those stay
 * client-side.
 */
export interface ProductQueryParams {
  category_id?: number;
  sub_category_id?: number;
  size?: string;
  search?: string;
}

export async function getProducts(params?: ProductQueryParams) {
  const response = await api.get<ProductListResponse>(
    "/v1/products_management/",
    params && Object.keys(params).length ? { params } : undefined
  );

  return response.data.data;
}

export async function getProductById(id: string | number) {
  const response = await api.get<ProductDetailResponse>(
    `/v1/products_management/?id=${id}`
  );

  return response.data.data;
}
/* ------------------------------------------------------------------ admin (CRUD) */

/**
 * Admin write operations on /v1/products_management/.
 *
 * VERIFIED from the backend's published OpenAPI schema (GET /api/schema/):
 *   - POST `CreateProductRequest` and PUT `UpdateProductRequest` accept application/json
 *     (also urlencoded/multipart). Required: `category_id` + `name`; PUT also `id`.
 *   - Variants carry decimal STRINGS (`mrp`, `selling_price`, `cost_price`) and a nested
 *     `sizes` array. A child with an `id` is updated, one without is created, and
 *     `delete_variant_ids` / `delete_size_ids` / `delete_tag_ids` soft-delete children.
 *   - DELETE takes `id` as a query parameter and soft-deletes the product.
 *
 * NOT VERIFIED: any 2xx payload — the schema documents every response as "No response
 * body" and no admin session could be established from this environment.
 *
 * Admin authorization comes from the SHARED `adminAuthConfig` helper — the same one the
 * category service uses. The read functions above stay unauthenticated-by-default so the
 * existing customer surfaces keep working exactly as before.
 */

/** Flattens this backend's two `message` shapes (string, or field→messages) into one line. */
export function readProductApiMessage(message: unknown, fallback: string): string {
  if (typeof message === "string" && message.trim()) return message;
  if (message && typeof message === "object") {
    const parts: string[] = [];
    for (const [field, value] of Object.entries(message as Record<string, unknown>)) {
      const texts = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === "string")
        : typeof value === "string"
          ? [value]
          : [];
      for (const text of texts) parts.push(field === "detail" ? text : `${field}: ${text}`);
    }
    if (parts.length) return parts.join(" ");
  }
  return fallback;
}

/** Turns any thrown request error into a safe message (never a raw stack/SQL/exception). */
export function readProductApiError(error: unknown, fallback: string): string {
  if (error instanceof MissingAdminSessionError) return error.message;

  const response = (error as { response?: { status?: number; data?: ProductEnvelope } }).response;
  if (!response) return "Unable to connect to the server. Check your connection and try again.";

  const status = response.status;
  if (status === 401) return "Your admin session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to manage products.";
  if (status === 404) return "That product could not be found.";
  if (status === 409) return "A product with those details already exists.";
  if (status === 429) return "Too many requests. Please try again in a moment.";
  // 5xx bodies can carry raw DB/exception text — never surface it.
  if (status && status >= 500) return "The server is temporarily unavailable. Please try again shortly.";

  return readProductApiMessage(response.data?.message, fallback);
}

/** Drops empty values so only parameters the caller actually set are sent. */
function toAdminParams(query: ProductAdminQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.id !== undefined) params.id = query.id;
  if (query.category_id !== undefined) params.category_id = query.category_id;
  if (query.sub_category_id !== undefined) params.sub_category_id = query.sub_category_id;
  if (query.page !== undefined) params.page = query.page;
  if (query.page_size !== undefined) params.page_size = query.page_size;
  if (query.search?.trim()) params.search = query.search.trim();
  if (query.size?.trim()) params.size = query.size.trim();
  if (query.tag?.trim()) params.tag = query.tag.trim();
  if (query.min_price !== undefined) params.min_price = query.min_price;
  if (query.max_price !== undefined) params.max_price = query.max_price;
  if (query.sort_by?.trim()) params.sort_by = query.sort_by.trim();
  return params;
}

/** GET /v1/products_management/ with the documented paging/search parameters. */
export async function getProductsPage(query: ProductAdminQuery = {}) {
  const response = await api.get<ProductListResponse & { pagination?: ProductPagination }>(
    "/v1/products_management/",
    { params: toAdminParams(query) },
  );

  return {
    data: Array.isArray(response.data?.data) ? response.data.data : [],
    pagination: response.data?.pagination,
  };
}

/** POST /v1/products_management/ — creates a product with its variants and sizes. */
export async function createProduct(payload: ProductCreateDto) {
  return api.post("/v1/products_management/", payload, adminAuthConfig());
}

/** PUT /v1/products_management/ — updates a product; `id` identifies it. */
export async function updateProduct(payload: ProductUpdateDto) {
  return api.put("/v1/products_management/", payload, adminAuthConfig());
}

/**
 * DELETE /v1/products_management/?id=<id> — admin only.
 *
 * The backend soft-deletes; nothing is removed locally on the client's say-so, callers
 * re-fetch.
 */
export async function deleteProduct(id: number) {
  const config = adminAuthConfig();
  return api.delete("/v1/products_management/", { ...config, params: { id } });
}
