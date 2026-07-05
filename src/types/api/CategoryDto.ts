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