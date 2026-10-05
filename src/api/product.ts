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

/**
 * The `pagination` block the list endpoint returns beside `data`.
 *
 * Field names verified live against GET /v1/products_management/ (2026-10-05):
 * `{"page":1,"page_size":20,"total_records":21,"total_pages":2,"has_next":true,
 * "has_previous":false}`. The current page is `page` — this interface previously declared
 * `current_page`, which the backend has never sent; nothing read it, so no caller changes.
 */
export interface ProductPagination {
  page: number;
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
  pagination?: ProductPagination;
}

interface ProductDetailResponse {
  success: boolean;
  message: string;
  data: ProductDetailDto;
}

/** Backend-supported values for `sort_by`. `latest` is the backend's own default. */
export type ProductSortBy =
  | "latest"
  | "oldest"
  | "price_low_to_high"
  | "price_high_to_low"
  | "display_order";

/**
 * Verified-real server-side filters on `/v1/products_management/` (confirmed
 * against the live backend — see category_id/sub_category_id SQL error leak,
 * and empty-vs-nonempty diffing for size/search). Price filtering is still NOT
 * supported server-side, so that stays client-side.
 *
 * `sort_by` IS now supported — re-verified live: `oldest`, `price_low_to_high` and
 * `price_high_to_low` each return a distinct order, and `sort_by=display_order` returns
 * the catalogue strictly ascending by that field (1..22 across the full list). Sorting a
 * curated order therefore belongs on the server, so it stays correct across pages rather
 * than only within the page already loaded.
 */
export interface ProductQueryParams {
  category_id?: number;
  sub_category_id?: number;
  size?: string;
  search?: string;
  sort_by?: ProductSortBy;
  /**
   * 1-based page. Omitting it gets the backend's first page.
   *
   * THIS IS THE FIX for "the shop only ever shows 20 products": the list endpoint has
   * always paginated at a default `page_size` of 20 and reported `has_next` in its
   * `pagination` block, but no storefront caller ever sent `page`, so page 2 was never
   * requested and the 21st product was unreachable. Verified live (2026-10-05):
   * `?page=2` returns the remainder, and `page`/`page_size` compose correctly with
   * `category_id`, `sub_category_id`, `size`, `search` and every `sort_by` value.
   */
  page?: number;
  /** Rows per page. Omitting it uses the backend's default of 20. */
  page_size?: number;
}

/** A single page of the list endpoint, with the paging metadata the caller needs. */
export interface ProductListPage {
  products: ProductDto[];
  /** null when the response carried no `pagination` block — never fabricated. */
  pagination: ProductPagination | null;
}

/**
 * GET /v1/products_management/ — one page, with its pagination metadata.
 *
 * Prefer this over `getProducts` anywhere the full result set matters: `getProducts`
 * discards `pagination`, so a caller using it silently sees only the first page.
 */
export async function getProductsPageList(
  params: ProductQueryParams = {}
): Promise<ProductListPage> {
  const response = await api.get<ProductListResponse>(
    "/v1/products_management/",
    Object.keys(params).length ? { params } : undefined
  );

  return {
    products: Array.isArray(response.data?.data) ? response.data.data : [],
    pagination: response.data?.pagination ?? null,
  };
}

export async function getProducts(params?: ProductQueryParams) {
  const { products } = await getProductsPageList(params ?? {});
  return products;
}

/**
 * Every product matching `params`, by following `has_next` across pages.
 *
 * Used where a partial catalogue would give a wrong ANSWER rather than just a short list —
 * the Shop page derives its Sub Category filter options this way, and deriving them from
 * page 1 alone would hide any sub-category whose only products sit on a later page.
 *
 * `page_size` is deliberately large so this is one request for a catalogue of this size,
 * and `maxPages` is a hard stop so a backend that always reported `has_next` could never
 * spin here.
 */
export async function getAllProducts(
  params: ProductQueryParams = {},
  { pageSize = 100, maxPages = 20 }: { pageSize?: number; maxPages?: number } = {}
): Promise<ProductDto[]> {
  const all: ProductDto[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const { products, pagination } = await getProductsPageList({
      ...params,
      page,
      page_size: pageSize,
    });

    all.push(...products);

    // Stop on an explicit "no more", and also on a short/empty page so a response with no
    // pagination block ends the loop instead of being paged forever.
    if (pagination?.has_next !== true || products.length === 0) break;
  }

  return all;
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
/**
 * New image files to upload, keyed by the variant's ZERO-BASED POSITION in the payload's
 * `variants` array — not by variant id. The backend reads `variant_<index>_images`.
 */
export type VariantImageFiles = Map<number, File[]>;

/**
 * 1-based `display_order` for each new file, keyed by the same variant index and held in
 * the SAME order as that variant's entry in `VariantImageFiles` — entry `n` here is the
 * order for file `n` there. Sent as repeated `variant_<index>_image_orders` fields.
 */
export type VariantImageOrders = Map<number, number[]>;

/**
 * Builds the multipart body the image contract specifies: the whole product payload as a
 * JSON string under `data`, then every file appended under `variant_<index>_images`.
 *
 * Images never appear inside the JSON — no `images` key is added to any variant.
 */
function toProductFormData(
  payload: unknown,
  images: VariantImageFiles,
  imageOrders?: VariantImageOrders,
): FormData {
  const formData = new FormData();
  formData.append("data", JSON.stringify(payload));

  for (const [index, files] of images) {
    const orders = imageOrders?.get(index);

    files.forEach((file, position) => {
      // Several files share one field name; that is how the backend receives a list.
      formData.append(`variant_${index}_images`, file);

      // Appended in the SAME iteration as its file, so the two repeated fields stay
      // positionally aligned — the backend pairs them by position, not by name.
      const order = orders?.[position];
      if (order !== undefined) {
        formData.append(`variant_${index}_image_orders`, String(order));
      }
    });
  }

  return formData;
}

function hasFiles(images: VariantImageFiles | undefined): boolean {
  if (!images) return false;
  for (const files of images.values()) if (files.length) return true;
  return false;
}

/**
 * Config for a multipart write. `Content-Type` is explicitly unset so the browser generates
 * the multipart boundary itself — it is never set to "multipart/form-data" by hand, which
 * would omit the boundary and break the request. The admin Authorization header is
 * unchanged and still comes from `adminAuthConfig`.
 */
function multipartConfig() {
  const config = adminAuthConfig();
  return { ...config, headers: { ...config.headers, "Content-Type": undefined } };
}

/**
 * POST /v1/products_management/ — creates a product.
 *
 * Without images this sends exactly the JSON body it always has. With images it switches to
 * multipart, so image-free creates keep their existing behaviour untouched.
 */
export async function createProduct(
  payload: ProductCreateDto,
  images?: VariantImageFiles,
  imageOrders?: VariantImageOrders,
) {
  if (hasFiles(images)) {
    return api.post(
      "/v1/products_management/",
      toProductFormData(payload, images!, imageOrders),
      multipartConfig(),
    );
  }

  return api.post("/v1/products_management/", payload, adminAuthConfig());
}

/** PUT /v1/products_management/ — updates a product; `id` identifies it. */
/**
 * PUT /v1/products_management/ — updates a product; `id` identifies it.
 *
 * Multipart is used when images are added OR when existing images are being deleted;
 * everything else keeps the existing JSON request unchanged.
 */
export async function updateProduct(
  payload: ProductUpdateDto,
  images?: VariantImageFiles,
  imageOrders?: VariantImageOrders,
) {
  const removingImages = Boolean(payload.delete_variant_image_ids?.length);

  if (hasFiles(images) || removingImages) {
    return api.put(
      "/v1/products_management/",
      toProductFormData(payload, images ?? new Map(), imageOrders),
      multipartConfig(),
    );
  }

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
