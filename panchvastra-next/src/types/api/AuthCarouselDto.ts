/**
 * Auth Carousel contract for /v1/auth_carousel/.
 *
 * VERIFIED LIVE against the production API (no token sent):
 *   GET /v1/auth_carousel/ -> 200
 *   {"success":true,"message":"Data fetched successfully.","data":[
 *     {"id":1,"image_url":"https://images.panchvastra.com/auth-carousel/login-1.webp",
 *      "display_order":1,"is_active":true}, ... ]}
 *
 * So a row is exactly: `id`, `image_url`, `display_order`, `is_active`. There is no
 * `pagination` block on this endpoint, unlike Categories/Sub-Categories.
 *
 * Per the published OpenAPI description, GET is public and returns ONLY active images;
 * sending an admin token additionally returns inactive ones so the admin panel can find
 * and re-activate them. The customer-facing carousel therefore never depends on a token,
 * and still filters on `is_active` itself so a signed-in session can never leak an
 * inactive image into the storefront.
 *
 * Note the asymmetry shared with Categories: reads return `image_url`, while the
 * multipart write field is `image`.
 */

export interface AuthCarouselDto {
  id: number;
  image_url: string;
  display_order: number;
  is_active: boolean;
}

export interface AuthCarouselListResponse {
  success: boolean;
  message: string | Record<string, string[]>;
  data: AuthCarouselDto[];
}

/** Query parameters the endpoint accepts. */
export interface AuthCarouselQuery {
  id?: number;
}

/**
 * Multipart body for POST/PUT, per `CreateAuthCarouselImageRequest` /
 * `UpdateAuthCarouselImageRequest` in the published schema.
 *
 * POST requires `image`; `display_order` is assigned as (highest + 1) when omitted.
 * PUT requires `id` and takes every other field as optional — so changing only the order
 * or the active flag never needs a re-upload.
 */
export interface AuthCarouselWritePayload {
  id?: number;
  /** Only set when the admin actually picked a file; otherwise the stored image is kept. */
  image?: File | null;
  display_order?: number;
  is_active?: boolean;
}
