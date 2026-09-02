import api from "./axios";
import { adminAuthConfig, MissingAdminSessionError } from "./adminRequest";
import type {
  SubCategoryDto,
  SubCategoryListResponse,
  SubCategoryQuery,
  SubCategoryWritePayload,
} from "@/types/api/SubCategoryDto";

/**
 * Sub-Categories Management API.
 *
 * VERIFIED LIVE: GET /v1/sub_categories_management/ is public (200 with no token) and
 * honours `category_id`, `search_parameter`, `page` and `page_size`.
 *
 * Writes are admin-only and send the admin token explicitly through the shared
 * `adminAuthConfig` helper — the same one Categories and Products already use. Reads stay
 * unauthenticated so the product form can populate its dropdown without a session.
 *
 * Unlike Categories (multipart only), these writes are plain JSON, so the shared client's
 * default `Content-Type: application/json` is exactly right and is left alone.
 */

export { MissingAdminSessionError };

type SubCategoryEnvelope = {
  success?: boolean;
  message?: string | Record<string, string[]>;
  data?: unknown;
};

/** Flattens this backend's two `message` shapes (string, or field→messages) into one line. */
export function readSubCategoryApiMessage(message: unknown, fallback: string): string {
  if (typeof message === "string" && message.trim()) return message;

  if (message && typeof message === "object") {
    const parts: string[] = [];
    for (const value of Object.values(message as Record<string, unknown>)) {
      if (Array.isArray(value)) parts.push(...value.filter((v): v is string => typeof v === "string"));
      else if (typeof value === "string") parts.push(value);
    }
    if (parts.length) return parts.join(" ");
  }

  return fallback;
}

/**
 * Turns a thrown request error into a message safe to show an admin.
 *
 * Business messages the backend defines — "Sub category already exists.", "Sub category not
 * found.", "Category doesn't exist or isn't active." — are surfaced verbatim. 5xx bodies can
 * carry raw exception text, so those are replaced with a generic line.
 */
export function readSubCategoryApiError(error: unknown, fallback: string): string {
  if (error instanceof MissingAdminSessionError) return error.message;

  const response = (error as { response?: { status?: number; data?: SubCategoryEnvelope } }).response;
  if (!response) return "Unable to connect to the server. Please check your connection and try again.";

  const status = response.status;
  if (status === 401 || status === 403) return "Your admin session has expired. Please sign in again.";
  if (typeof status === "number" && status >= 500) {
    return "The server is temporarily unavailable. Please try again shortly.";
  }

  return readSubCategoryApiMessage(response.data?.message, fallback);
}

/** Drops undefined/empty values so only real parameters reach the query string. */
function toParams(query: SubCategoryQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.id !== undefined) params.id = query.id;
  if (query.category_id !== undefined) params.category_id = query.category_id;
  if (query.search_parameter) params.search_parameter = query.search_parameter;
  if (query.page !== undefined) params.page = query.page;
  if (query.page_size !== undefined) params.page_size = query.page_size;
  return params;
}

/**
 * GET /v1/sub_categories_management/ — the rows only.
 *
 * Used by the product form's dropdown with `{ category_id }`. Public: no token is sent.
 */
export async function listSubCategories(query: SubCategoryQuery = {}) {
  const response = await api.get<SubCategoryListResponse>("/v1/sub_categories_management/", {
    params: toParams(query),
  });

  return Array.isArray(response.data?.data) ? response.data.data : [];
}

/** Same call, returning the pagination block for the admin list's search and paging. */
export async function getSubCategoriesPage(query: SubCategoryQuery = {}) {
  const response = await api.get<SubCategoryListResponse>("/v1/sub_categories_management/", {
    params: toParams(query),
  });

  return {
    data: Array.isArray(response.data?.data) ? response.data.data : [],
    // Omitted by the API when the result set is empty.
    pagination: response.data?.pagination,
  };
}

/** POST /v1/sub_categories_management/ — admin only. `is_active` defaults to true server-side. */
export async function createSubCategory(payload: {
  category_id: number;
  name: string;
  is_active?: boolean;
}) {
  return api.post("/v1/sub_categories_management/", payload, adminAuthConfig());
}

/**
 * PUT /v1/sub_categories_management/ — admin only.
 *
 * `id` is always required; every other field is sent ONLY when the admin actually changed
 * it, so an untouched name/category/status can never be overwritten.
 */
export async function updateSubCategory(payload: SubCategoryWritePayload & { id: number }) {
  return api.put("/v1/sub_categories_management/", payload, adminAuthConfig());
}

/**
 * DELETE /v1/sub_categories_management/?id=<id> — admin only.
 *
 * The backend soft-deletes; callers re-fetch rather than removing the row locally.
 */
export async function deleteSubCategory(id: number) {
  const config = adminAuthConfig();
  return api.delete("/v1/sub_categories_management/", { ...config, params: { id } });
}

export type { SubCategoryDto };
