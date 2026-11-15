/** Address record as returned by GET /v1/address_management/. */
export interface AddressDto {
  id: number
  full_name: string
  mobile: string
  address_line_1: string
  address_line_2: string | null
  landmark: string | null
  city: string
  state: string
  country: string
  pincode: string
  address_type: string
  is_default: boolean
}

/** Request body for POST /v1/address_management/ (no `id` — the backend assigns it). */
export interface AddressCreateDto {
  full_name: string
  mobile: string
  address_line_1: string
  address_line_2: string
  landmark: string
  city: string
  state: string
  country: string
  pincode: string
  address_type: string
  is_default: boolean
}

/** Request body for PUT /v1/address_management/ — same fields plus the target `id`. */
export interface AddressUpdateDto extends AddressCreateDto {
  id: number
}
