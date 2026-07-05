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