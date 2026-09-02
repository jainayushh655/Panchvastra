/**
 * Sub-Categories Management contract for /v1/sub_categories_management/.
 *
 * VERIFIED LIVE against the production API:
 *   GET /v1/sub_categories_management/            -> 200, no token required
 *   GET ?category_id=1                            -> only that category's rows
 *   GET ?category_id=8 (none)                     -> {"success":true,"message":"Data not found.","data":[]}
 *   GET ?search_parameter=Oversized               -> matching rows
 *
 * A subcategory belongs to exactly one category, and names only need to be unique within
 * that category — the backend owns that rule, so no global uniqueness check is done here.
 */

export interface SubCategoryDto {
  id: number;
  category_id: number;
  name: string;
  is_active: boolean;
}

export interface SubCategoryListResponse {
  success: boolean;
  message: string;
  data: SubCategoryDto[];
  /** Absent when the list is empty — the API omits it on "Data not found." */
  pagination?: {
    current_page: number;
    page_size: number;
    total_pages: number;
    total_records: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

/** Query parameters the endpoint accepts. */
export interface SubCategoryQuery {
  id?: number;
  category_id?: number;
  search_parameter?: string;
  page?: number;
  page_size?: number;
}

/**
 * JSON body for POST/PUT. Unlike Categories (multipart only), these writes are JSON.
 *
 * On update only `id` plus the fields actually being changed are sent, so an untouched
 * field can never be overwritten.
 */
export interface SubCategoryWritePayload {
  id?: number;
  category_id?: number;
  name?: string;
  is_active?: boolean;
}
