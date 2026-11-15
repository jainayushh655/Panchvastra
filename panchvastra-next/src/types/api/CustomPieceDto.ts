/**
 * Custom Piece contract for `/v1/custom_options/` and `/v1/custom_requests/`.
 *
 * VERIFIED LIVE against the production API, with no token:
 *   GET /v1/custom_options/ -> 200
 *   {"success":true,"message":"Data fetched successfully.","data":{
 *     "garments":[{"id":1,"name":"Oversized T-Shirt","display_order":1,"description":null,
 *                  "image_url":null,"colour_ids":[4,5]}, ...],
 *     "colours":[{"id":4,"name":"Black","display_order":1,"hex_code":"#000000"}, ...],
 *     "sizes":[{"id":6,"name":"S","display_order":1}, ...],
 *     "print_types":[{"id":11,"name":"Print","display_order":1,
 *                     "description":"High-quality DTF / DTG printing...","image_url":null}, ...]}}
 *
 *   GET /v1/custom_requests/ (no token) -> 401
 *   {"success": false, "message": "Authorization token missing.", "data": {}}
 *
 * The published OpenAPI schema documents the REQUEST bodies for every verb but declares no
 * response schema for any of them, so only the shapes actually observed above are typed
 * here. Nothing is guessed: see `CustomRequestDto` for what is still unknown.
 */

/** Four kinds of choice an admin can manage. From `OptionTypeEnum` in the published schema. */
export const OPTION_TYPES = ['GARMENT', 'COLOUR', 'SIZE', 'PRINT_TYPE'] as const
export type OptionType = (typeof OPTION_TYPES)[number]

/**
 * Fields every option carries. `is_active` is only returned to an admin token asking for
 * `include_inactive=true`; the public view omits it entirely, hence optional.
 */
interface CustomOptionBase {
  id: number
  name: string
  display_order: number
  is_active?: boolean
}

export interface GarmentDto extends CustomOptionBase {
  description: string | null
  image_url: string | null
  /** The ONLY colours this garment can be ordered in. */
  colour_ids: number[]
}

export interface ColourDto extends CustomOptionBase {
  hex_code: string | null
}

export type SizeDto = CustomOptionBase

export interface PrintTypeDto extends CustomOptionBase {
  description: string | null
  image_url: string | null
}

export interface CustomOptionsDto {
  garments: GarmentDto[]
  colours: ColourDto[]
  sizes: SizeDto[]
  print_types: PrintTypeDto[]
}

/**
 * The customer's submission, per `CreateCustomRequestRequest` in the published schema.
 * multipart/form-data only. `design_file` and `design_description` are each nullable, but
 * the endpoint description requires AT LEAST ONE of them.
 */
export interface CreateCustomRequestPayload {
  garment_id: number
  colour_id: number
  size_id: number
  print_type_id: number
  design_file?: File | null
  /** Max 300 characters. */
  design_description?: string | null
  /** Max 100 characters. */
  full_name: string
  /** Max 5 characters, defaults to '+91'. */
  phone_country_code: string
  /** Max 15 characters. */
  phone_number: string
}

/** Admin status values, from `UpdateCustomRequestStatusEnum` in the published schema. */
export const CUSTOM_REQUEST_STATUSES = [
  'NEW',
  'IN_REVIEW',
  'APPROVED',
  'IN_PRODUCTION',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const
export type CustomRequestStatus = (typeof CUSTOM_REQUEST_STATUSES)[number]

/** Create/update bodies for the admin option endpoints, per the published schema. */
export interface CreateCustomOptionPayload {
  option_type: OptionType
  /** Max 100 characters. */
  name: string
  /** Max 500 characters. GARMENT and PRINT_TYPE only. */
  description?: string | null
  /** `#RRGGBB`. COLOUR only. */
  hex_code?: string | null
  /** GARMENT and PRINT_TYPE only. */
  image?: File | null
  /** GARMENT only — repeated once per id in multipart. */
  colour_ids?: number[]
  /** Omit to place the option last within its type. */
  display_order?: number | null
  is_active?: boolean
}

/** `option_type` cannot change; send only what changes. */
export interface UpdateCustomOptionPayload {
  id: number
  name?: string
  description?: string | null
  hex_code?: string | null
  image?: File | null
  /** Replaces the garment's WHOLE colour list. */
  colour_ids?: number[]
  display_order?: number | null
  is_active?: boolean | null
}

/** Admin moves a request along and/or leaves a note. Send `status`, `note`, or both. */
export interface UpdateCustomRequestPayload {
  id: number
  status?: CustomRequestStatus
  /** Max 2000 characters. */
  note?: string | null
}

/**
 * The `pagination` block beside `data`. This IS documented: it is the shared `Pagination`
 * component in the published schema, required on the one admin list response the schema
 * models (`NotifyMeAdminListResponse`). Numbers are typed loosely because DRF serialises
 * some of them as strings.
 */
export interface CustomRequestPaginationDto {
  current_page?: number | string | null
  page_size?: number | string | null
  total_pages?: number | string | null
  total_records?: number | string | null
  has_next?: boolean | null
  has_previous?: boolean | null
}

/** Query parameters `GET /v1/custom_requests/` documents. */
export interface CustomRequestQuery {
  id?: number
  page?: number
  page_size?: number
  search_parameter?: string
  status?: string
}

/**
 * One entry in a request's history.
 *
 * UNDOCUMENTED SHAPE — see `CustomRequestDto` below. Every field is optional and read
 * through the accessors in `customRequests.ts`, so a missing key renders as a dash rather
 * than throwing.
 */
export interface CustomRequestHistoryDto {
  id?: number
  status?: string | null
  status_label?: string | null
  note?: string | null
  created_at?: string | null
  changed_by?: string | null
  changed_by_name?: string | null
  [key: string]: unknown
}

/**
 * One custom request.
 *
 * ⚠ THE RESPONSE SHAPE IS NOT DOCUMENTED. The published schema declares
 * `"200": {"description": "No response body"}` for every verb on `/v1/custom_requests/`,
 * and the endpoint returns 401 to an anonymous read, so it cannot be observed either.
 *
 * What IS solid:
 *   - the envelope `{success, message, data, pagination}` and the `Pagination` shape, both
 *     documented on this backend's one modelled admin list response;
 *   - the `<thing>_name` and `created_at` conventions, documented on `NotifyMeAdminItem`
 *     from this same API;
 *   - `status` values, from `UpdateCustomRequestStatusEnum`.
 *
 * Everything below is therefore OPTIONAL, and the index signature keeps any field this
 * list misses reachable. Nothing is asserted: the accessors in `customRequests.ts` try a
 * short list of candidate keys per field and fall back to null, so an unexpected name
 * shows an empty cell instead of crashing the screen. When a real response is available,
 * correcting a field is a one-line change in that accessor.
 */
export interface CustomRequestDto {
  id: number
  request_number?: string | null
  garment_name?: string | null
  colour_name?: string | null
  size_name?: string | null
  print_type_name?: string | null
  status?: string | null
  status_label?: string | null
  created_at?: string | null
  updated_at?: string | null
  full_name?: string | null
  phone_country_code?: string | null
  phone_number?: string | null
  email?: string | null
  user_id?: number | null
  design_file_url?: string | null
  design_description?: string | null
  history?: CustomRequestHistoryDto[] | null
  [key: string]: unknown
}

/** The maximum design-file size the backend enforces, mirrored here to fail fast. */
export const DESIGN_FILE_MAX_BYTES = 10 * 1024 * 1024

/** Accepted design-file types. The backend checks by CONTENT, not by extension. */
export const DESIGN_FILE_ACCEPT = '.png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf'
export const DESIGN_FILE_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']

export const DESIGN_DESCRIPTION_MAX = 300
export const FULL_NAME_MAX = 100
export const PHONE_NUMBER_MAX = 15
export const PHONE_COUNTRY_CODE_MAX = 5
export const DEFAULT_PHONE_COUNTRY_CODE = '+91'
