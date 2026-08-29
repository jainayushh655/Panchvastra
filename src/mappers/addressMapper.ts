import type { AddressCreateDto, AddressDto, AddressUpdateDto } from '@/types/api/AddressDto'
import { ADDRESS_TYPE_OPTIONS, type AddressType, type ProfileAddress } from '@/lib/mockProfile'

const KNOWN_ADDRESS_TYPES = new Set<string>(ADDRESS_TYPE_OPTIONS.map((option) => option.value))

/**
 * UI value → the enum value the backend accepts.
 *
 * The API's `AddressTypeEnum` is case-sensitive Title Case (`Home` | `Work` | `Other`) and
 * rejects anything else (`"home" is not a valid choice.`), so the internal lowercase UI
 * values are translated here — the only place the outbound value is produced.
 */
const API_ADDRESS_TYPE: Record<AddressType, string> = {
  home: 'Home',
  work: 'Work',
  other: 'Other',
}

/**
 * Backend value → the UI value. Matching is case-insensitive, so `HOME`, `Home` and `home`
 * all select HOME; anything unrecognised falls back to 'other'.
 */
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
    address_type: API_ADDRESS_TYPE[address.type],
    is_default: address.isDefault,
  }
}

/** UI model → PUT body (create payload plus the numeric `id` the backend expects). */
export function toAddressUpdateDto(address: ProfileAddress): AddressUpdateDto {
  return { id: Number(address.id), ...toAddressCreateDto(address) }
}
