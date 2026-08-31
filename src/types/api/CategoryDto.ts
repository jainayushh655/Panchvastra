export interface CategoryDto {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  is_active: boolean;

  created_at: string;
  created_by: number | null;

  updated_at: string;
  updated_by: number | null;
}

export interface CategoryListResponse {
  success: boolean;
  message: string;

  data: CategoryDto[];

  pagination: {
    current_page: number;
    page_size: number;
    total_pages: number;
    total_records: number;
    has_next: boolean;
    has_previous: boolean;
  };
}
/** Query parameters accepted by GET /v1/categories_management/, per the published schema. */
export interface CategoryQuery {
  id?: number;
  page?: number;
  page_size?: number;
  search_parameter?: string;
}

/**
 * Multipart write payload for POST/PUT /v1/categories_management/.
 *
 * Reads return `image_url`; writes send the file as `image`. `image` is only ever included
 * when the admin picked a new file, so an existing image survives an update untouched.
 */
export interface CategoryWritePayload {
  /** Required by PUT; omitted on create. */
  id?: number;
  name?: string;
  description?: string;
  is_active?: boolean;
  image?: File | null;
}
