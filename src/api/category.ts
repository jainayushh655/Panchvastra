import api from "./axios";
import { adminAuthConfig, MissingAdminSessionError } from "./adminRequest";
import type {
  CategoryDto,
  CategoryListResponse,
  CategoryQuery,
  CategoryWritePayload,
} from "@/types/api/CategoryDto";

/**
 * Categories Management API.
 *
 * VERIFIED from the backend's published OpenAPI schema (GET /api/schema/):
 *   - GET accepts `id`, `page`, `page_size` and `search_parameter`.
 *   - POST (`CreateCategoryRequest`) and PUT (`UpdateCategoryRequest`) accept ONLY
 *     multipart/form-data or x-www-form-urlencoded — NOT JSON. Fields: `name` (required,
 *     max 255), `description`, `image` (binary) and `is_active`; PUT additionally requires
 *     `id`. Note the write field is `image`, while reads return `image_url`.
 *   - DELETE takes `id` as a query parameter and soft-deletes.
 *
 * The write calls are admin-only and send the admin token explicitly via `adminAuthConfig`.
 * The read calls stay unauthenticated-by-default so the existing customer surfaces
 * (Navbar, Home, Shop) keep working exactly as before through the shared client.
 */

export { MissingAdminSessionError };

type CategoryEnvelope = {
  success?: boolean;
  message?: string | Record<string, string[]>;
  data?: unknown;
};

/** Flattens this backend's two `message` shapes (string, or field→messages) into one line. */
export function readCategoryApiMessage(message: unknown, fallback: string): string {
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
export function readCategoryApiError(error: unknown, fallback: string): string {
  if (error instanceof MissingAdminSessionError) return error.message;

  const response = (error as { response?: { status?: number; data?: CategoryEnvelope } }).response;
  if (!response) return "Unable to connect to the server. Check your connection and try again.";

  const status = response.status;
  if (status === 401) return "Your admin session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to manage categories.";
  if (status === 404) return "That category could not be found.";
  if (status === 409) return "A category with that name already exists.";
  if (status === 429) return "Too many requests. Please try again in a moment.";
  // 5xx bodies can carry raw DB/exception text — never surface it.
  if (status && status >= 500) return "The server is temporarily unavailable. Please try again shortly.";

  return readCategoryApiMessage(response.data?.message, fallback);
}

/** Drops empty values so only parameters the caller actually set are sent. */
function toParams(query: CategoryQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.id !== undefined) params.id = query.id;
  if (query.page !== undefined) params.page = query.page;
  if (query.page_size !== undefined) params.page_size = query.page_size;
  if (query.search_parameter?.trim()) params.search_parameter = query.search_parameter.trim();
  return params;
}

/**
 * GET /v1/categories_management/ — the category list.
 *
 * Signature is unchanged for existing callers (Navbar, Home, Shop call it with no
 * arguments and receive the array).
 */
export async function getCategories(query: CategoryQuery = {}) {
  const response = await api.get<CategoryListResponse>("/v1/categories_management/", {
    params: toParams(query),
  });

  return response.data.data;
}

/**
 * GET /v1/categories_management/ returning the pagination block alongside the rows, for
 * the admin list's server-side search and paging.
 */
export async function getCategoriesPage(query: CategoryQuery = {}) {
  const response = await api.get<CategoryListResponse>("/v1/categories_management/", {
    params: toParams(query),
  });

  return {
    data: Array.isArray(response.data?.data) ? response.data.data : [],
    pagination: response.data?.pagination,
  };
}

/**
 * Builds the multipart body both writes require.
 *
 * `image` is appended ONLY when a new file was chosen, so an existing image is left
 * untouched on update. Undefined fields are never sent.
 */
function toCategoryFormData(payload: CategoryWritePayload): FormData {
  const formData = new FormData();

  if (payload.id !== undefined) formData.append("id", String(payload.id));
  if (payload.name !== undefined) formData.append("name", payload.name.trim());
  if (payload.description !== undefined) formData.append("description", payload.description.trim());
  if (payload.is_active !== undefined) formData.append("is_active", String(payload.is_active));
  if (payload.image) formData.append("image", payload.image);

  return formData;
}

/**
 * POST /v1/categories_management/ — multipart/form-data, per the published contract.
 *
 * `Content-Type` is explicitly unset so the browser generates the multipart boundary; the
 * shared client's JSON default would otherwise make the body unparseable.
 */
export async function createCategory(payload: CategoryWritePayload) {
  const config = adminAuthConfig();
  return api.post("/v1/categories_management/", toCategoryFormData(payload), {
    ...config,
    headers: { ...config.headers, "Content-Type": undefined },
  });
}

/** PUT /v1/categories_management/ — multipart/form-data; `id` identifies the category. */
export async function updateCategory(payload: CategoryWritePayload & { id: number }) {
  const config = adminAuthConfig();
  return api.put("/v1/categories_management/", toCategoryFormData(payload), {
    ...config,
    headers: { ...config.headers, "Content-Type": undefined },
  });
}

/**
 * DELETE /v1/categories_management/?id=<id> — admin only.
 *
 * The backend soft-deletes; nothing is removed locally on the client's say-so, callers
 * re-fetch.
 */
export async function deleteCategory(id: number) {
  const config = adminAuthConfig();
  return api.delete("/v1/categories_management/", { ...config, params: { id } });
}

export type { CategoryDto };
