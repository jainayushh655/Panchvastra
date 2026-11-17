export interface ProductTagDto {
  id: number
  name: string
}

export interface ProductCategoryDto {
  id: number
  name: string
}

export interface ProductSubCategoryDto {
  id: number
  name: string
}

export interface ProductDto {
  id: number
  name: string
  description: string

  fabric: string
  gsm: number

  is_featured: boolean
  is_new_arrival: boolean

  created_at: string

  /**
   * Curated position in the catalogue, 1-based. Verified present on the live list response.
   * Optional so a product without one is readable; a missing value is never read as 0, and
   * nothing in the mappers sorts on it — the backend does that via `sort_by=display_order`.
   */
  display_order?: number | null

  variant_id: number

  sku: string

  color: string

  mrp: number

  selling_price: number

  primary_image: string

  discount_amount: number

  discount_percentage: number

  tags: ProductTagDto[]

  category: ProductCategoryDto

  sub_category: ProductSubCategoryDto
}