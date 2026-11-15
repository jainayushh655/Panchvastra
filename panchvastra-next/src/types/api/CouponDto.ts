/**
 * Coupon contract for /v1/coupon_management/.
 *
 * Field names, types and required-ness below come from the backend's own published
 * OpenAPI schema (GET /api/schema/ → `CouponRequest`, `UpdateCouponRequest`,
 * `DiscountTypeEnum`), not from assumption.
 *
 * Note the decimal fields are DECIMAL STRINGS in the contract (DRF serialises Decimal that
 * way), not numbers, and are sent as strings.
 */

/** The only discount types the backend accepts (`DiscountTypeEnum`). */
export const DISCOUNT_TYPES = ['PERCENTAGE', 'FLAT'] as const

export type DiscountType = (typeof DISCOUNT_TYPES)[number]

/**
 * A coupon record as returned by GET /v1/coupon_management/.
 *
 * The schema documents the 200 as "No response body", so the response is read
 * defensively — every field is optional and the UI renders only what is present.
 */
export interface CouponDto {
  id?: number | string | null
  code?: string | null
  discount_type?: string | null
  discount_value?: string | number | null
  maximum_discount_amount?: string | number | null
  minimum_order_amount?: string | number | null
  start_date?: string | null
  end_date?: string | null
  max_usage?: number | null
  max_usage_per_user?: number | null
  description?: string | null
  is_first_order_only?: boolean | null
  is_active?: boolean | null
  [key: string]: unknown
}

/**
 * Request body for POST /v1/coupon_management/ (`CouponRequest`).
 * Required by the backend: code, discount_type, discount_value, start_date, end_date.
 */
export interface CouponCreateDto {
  code: string
  discount_type: DiscountType
  /** Decimal string, e.g. "10.00". */
  discount_value: string
  maximum_discount_amount?: string | null
  minimum_order_amount?: string
  /** ISO 8601 date-time. */
  start_date: string
  end_date: string
  max_usage?: number | null
  max_usage_per_user?: number
  description?: string | null
  is_first_order_only?: boolean
  is_active?: boolean
}

/** Request body for PUT /v1/coupon_management/ (`UpdateCouponRequest`) — adds `id`. */
export interface CouponUpdateDto extends CouponCreateDto {
  id: number
}
