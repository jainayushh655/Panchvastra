import type { AddressCreateDto, AddressDto, AddressUpdateDto } from '@/types/api/AddressDto'
import { ADDRESS_TYPE_OPTIONS, type AddressType, type ProfileAddress } from '@/lib/mockProfile'

const KNOWN_ADDRESS_TYPES = new Set<string>(ADDRESS_TYPE_OPTIONS.map((option) => option.value))

/** Backend sends a free-form string; fall back to 'other' for anything the UI can't render. */
function toAddressType(value: string | null | undefined): AddressType {
  const normalized = (value ?? '').trim().toLowerCase()
  return KNOWN_ADDRESS_TYPES.has(normalized) ? (normalized as AddressType) : 'other'
}

/** API record → the camelCase model the Profile and Checkout UI already consume. */
export function mapAddress(dto: AddressDto): ProfileAddress {
  return {
    id: String(dto.id),
    type: toAddressType(dto.address_type),
    fullName: dto.full_name ?? '',
    phone: dto.mobile ?? '',
    addressLine1: dto.address_line_1 ?? '',
    addressLine2: dto.address_line_2 ?? '',
    landmark: dto.landmark ?? '',
    city: dto.city ?? '',
    state: dto.state ?? '',
    postalCode: dto.pincode ?? '',
    country: dto.country ?? '',
    isDefault: Boolean(dto.is_default),
  }
}

/** UI model → POST body. Only fields the backend contract defines are sent. */
export function toAddressCreateDto(address: ProfileAddress): AddressCreateDto {
  return {
    full_name: address.fullName.trim(),
    mobile: address.phone.trim(),
    address_line_1: address.addressLine1.trim(),
    address_line_2: address.addressLine2.trim(),
    landmark: address.landmark.trim(),
    city: address.city.trim(),
    state: address.state.trim(),
    country: address.country.trim(),
    pincode: address.postalCode.trim(),
    address_type: address.type,
    is_default: address.isDefault,
  }
}

/** UI model → PUT body (create payload plus the numeric `id` the backend expects). */
export function toAddressUpdateDto(address: ProfileAddress): AddressUpdateDto {
  return { id: Number(address.id), ...toAddressCreateDto(address) }
}
