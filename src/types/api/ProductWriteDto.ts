/**
 * Write contract for POST/PUT /v1/products_management/.
 *
 * Taken from the backend's published OpenAPI schema (GET /api/schema/ →
 * `CreateProductRequest`, `UpdateProductRequest`, `ProductVariantRequest`,
 * `ProductVariantSizeRequest`).
 *
 * Unlike Categories (multipart only), these endpoints accept application/json, so the
 * nested `variants` array can be sent directly.
 *
 * Note the decimal fields are DECIMAL STRINGS in the contract, not numbers.
 */

/** One size row inside a variant. `id` is present only for rows that already exist. */
export interface ProductVariantSizeWriteDto {
  id?: number | null
  size: string
  stock_quantity: number
  is_active?: boolean
}

/** One variant. `id` is present only for variants that already exist. */
export interface ProductVariantWriteDto {
  id?: number | null
  sku: string
  color: string
  /** Decimal string, e.g. "1899.00". */
  mrp: string
  selling_price: string
  cost_price?: string | null
  is_default?: boolean
  is_active?: boolean
  sizes: ProductVariantSizeWriteDto[]
}

/** POST body. Required by the backend: `category_id` and `name`. */
export interface ProductCreateDto {
  category_id: number
  sub_category_id?: number | null
  name: string
  description?: string | null
  fabric?: string | null
  gsm?: number | null
  is_featured?: boolean
  is_new_arrival?: boolean
  is_active?: boolean
  key_highlights?: unknown
  tags?: number[]
  variants?: ProductVariantWriteDto[]
}

/**
 * PUT body. Required: `id`, `category_id`, `name`.
 *
 * Per the endpoint's documented business rules, a child with an `id` is updated and one
 * without is created; the `delete_*` arrays soft-delete children the admin removed.
 */
export interface ProductUpdateDto extends ProductCreateDto {
  id: number
  delete_tag_ids?: number[]
  delete_variant_ids?: number[]
  delete_size_ids?: number[]
}

/** Query parameters accepted by GET /v1/products_management/, per the published schema. */
export interface ProductAdminQuery {
  id?: number
  category_id?: number
  sub_category_id?: number
  page?: number
  page_size?: number
  search?: string
  size?: string
  tag?: string
  min_price?: number
  max_price?: number
  sort_by?: string
}
