import api from "./axios";
import { adminAuthConfig, MissingAdminSessionError } from "./adminRequest";
import type {
  AuthCarouselDto,
  AuthCarouselListResponse,
  AuthCarouselQuery,
  AuthCarouselWritePayload,
} from "@/types/api/AuthCarouselDto";

/**
 * Auth Carousel API for /v1/auth_carousel/.
 *
 * VERIFIED LIVE: GET is public (200 with no token) and returns only active images. Writes
 * are admin-only and pass the admin token explicitly through the shared `adminAuthConfig`
 * helper, exactly as Categories, Sub-Categories and Products already do — the customer
 * token can never reach them.
 *
 * POST/PUT are multipart/form-data per the published schema. `Content-Type` is explicitly
 * unset on those calls so the browser generates the boundary; the shared client's JSON
 * default would otherwise make the body unparseable.
 */

export { MissingAdminSessionError };

type AuthCarouselEnvelope = {
  success?: boolean;
  message?: string | Record<string, string[]>;
  data?: unknown;
};

/** Flattens this backend's two `message` shapes (string, or field→messages) into one line. */
export function readAuthCarouselApiMessage(message: unknown, fallback: string): string {
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

/** Turns any thrown request error into a safe admin message (never a raw stack/SQL/exception). */
export function readAuthCarouselApiError(error: unknown, fallback: string): string {
  if (error instanceof MissingAdminSessionError) return error.message;

  const response = (error as { response?: { status?: number; data?: AuthCarouselEnvelope } }).response;
  if (!response) return "Unable to connect to the server. Check your connection and try again.";

  const status = response.status;
  if (status === 401) return "Your admin session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to manage the auth carousel.";
  if (status === 404) return "That carousel image could not be found.";
  if (status === 413) return "That image is too large for the server to accept.";
  if (status === 429) return "Too many requests. Please try again in a moment.";
  // 5xx bodies can carry raw DB/exception text — never surface it.
  if (status && status >= 500) return "The server is temporarily unavailable. Please try again shortly.";

  return readAuthCarouselApiMessage(response.data?.message, fallback);
}

/** Keeps only well-formed rows, so a malformed record can never render a broken image. */
function toRows(payload: unknown): AuthCarouselDto[] {
  if (!Array.isArray(payload)) return [];

  return payload.filter(
    (row): row is AuthCarouselDto =>
      !!row &&
      typeof row === "object" &&
      typeof (row as AuthCarouselDto).id === "number" &&
      typeof (row as AuthCarouselDto).image_url === "string" &&
      (row as AuthCarouselDto).image_url.trim().length > 0,
  );
}

/** Ascending `display_order`; ties fall back to `id` so the order is always deterministic. */
function byDisplayOrder(a: AuthCarouselDto, b: AuthCarouselDto): number {
  const orderA = typeof a.display_order === "number" ? a.display_order : Number.MAX_SAFE_INTEGER;
  const orderB = typeof b.display_order === "number" ? b.display_order : Number.MAX_SAFE_INTEGER;
  return orderA === orderB ? a.id - b.id : orderA - orderB;
}

/**
 * GET /v1/auth_carousel/ for customers — Home, Login and Signup.
 *
 * Public: no admin token is ever attached. The backend already returns active images only
 * for an anonymous request, but a signed-in shopper's token rides along on the shared
 * client, so `is_active` is re-checked here. That guarantees an inactive image cannot
 * reach the storefront regardless of who is signed in.
 */
export async function getActiveAuthCarouselImages(): Promise<AuthCarouselDto[]> {
  const response = await api.get<AuthCarouselListResponse>("/v1/auth_carousel/");

  return toRows(response.data?.data)
    .filter((row) => row.is_active !== false)
    .sort(byDisplayOrder);
}

/**
 * GET /v1/auth_carousel/ for the admin list — the admin token is sent, so inactive images
 * come back too and can be found and re-activated.
 */
export async function getAuthCarouselImagesForAdmin(
  query: AuthCarouselQuery = {},
): Promise<AuthCarouselDto[]> {
  const config = adminAuthConfig();
  const response = await api.get<AuthCarouselListResponse>("/v1/auth_carousel/", {
    ...config,
    ...(query.id !== undefined ? { params: { id: query.id } } : {}),
  });

  return toRows(response.data?.data).sort(byDisplayOrder);
}

/**
 * Builds the multipart body both writes require.
 *
 * `image` is appended ONLY when a new file was chosen, so an existing image is left
 * untouched on update. Fields the caller did not set are never sent.
 */
function toAuthCarouselFormData(payload: AuthCarouselWritePayload): FormData {
  const formData = new FormData();

  if (payload.id !== undefined) formData.append("id", String(payload.id));
  if (payload.display_order !== undefined) formData.append("display_order", String(payload.display_order));
  if (payload.is_active !== undefined) formData.append("is_active", String(payload.is_active));
  if (payload.image) formData.append("image", payload.image);

  return formData;
}

/**
 * POST /v1/auth_carousel/ — admin only, multipart/form-data.
 *
 * `image` is required by the contract. Omitting `display_order` lets the backend assign
 * the current highest + 1.
 */
export async function createAuthCarouselImage(payload: AuthCarouselWritePayload & { image: File }) {
  const config = adminAuthConfig();
  return api.post("/v1/auth_carousel/", toAuthCarouselFormData(payload), {
    ...config,
    headers: { ...config.headers, "Content-Type": undefined },
  });
}

/**
 * PUT /v1/auth_carousel/ — admin only, multipart/form-data.
 *
 * `id` identifies the row; the image is optional, so changing only `display_order` or
 * `is_active` never requires a re-upload.
 */
export async function updateAuthCarouselImage(payload: AuthCarouselWritePayload & { id: number }) {
  const config = adminAuthConfig();
  return api.put("/v1/auth_carousel/", toAuthCarouselFormData(payload), {
    ...config,
    headers: { ...config.headers, "Content-Type": undefined },
  });
}

/**
 * DELETE /v1/auth_carousel/?id=<id> — admin only.
 *
 * The backend soft-deletes; nothing is removed locally on the client's say-so, callers
 * re-fetch from the API afterwards.
 */
export async function deleteAuthCarouselImage(id: number) {
  const config = adminAuthConfig();
  return api.delete("/v1/auth_carousel/", { ...config, params: { id } });
}

export type { AuthCarouselDto };
