/**
 * Shared types and option lists for the Profile + Address Book UI.
 *
 * PERSONAL INFO is backed by the real /v1/user_profile/ API — see `src/api/profile.ts`
 * and `src/mappers/userProfileMapper.ts`. `ProfileInfo` below is the camelCase shape the
 * backend record maps into.
 *
 * ADDRESSES are backed by the real /v1/address_management/ API — see `src/api/address.ts`,
 * `src/mappers/addressMapper.ts` and `AddressProvider`. `ProfileAddress` is the camelCase
 * shape those map into.
 *
 * The two are separate backend resources and are never mixed in a single request.
 */

import { GENDER_VALUES, type GenderValue } from '@/types/api/UserProfileDto'

/**
 * Mirrors the backend's `GenderEnum` exactly (`Male` | `Female` | `Other`). The API
 * accepts no other values, so the UI must not offer any.
 */
export type Gender = GenderValue

export const GENDER_OPTIONS: { value: Gender; label: string }[] = GENDER_VALUES.map((value) => ({
  value,
  label: value,
}))

export type AddressType = 'home' | 'work' | 'other'

export const ADDRESS_TYPE_OPTIONS: { value: AddressType; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'work', label: 'Work' },
  { value: 'other', label: 'Other' },
]

export interface ProfileInfo {
  firstName: string
  lastName: string
  /** Read-only: PUT /v1/user_profile/ has no email field, so it is never submitted. */
  email: string
  /** Backend field name is `mobile`. */
  mobile: string
  gender: Gender | null
  /** ISO `YYYY-MM-DD`, or '' when not set. */
  dateOfBirth: string
  /** URL of the stored profile image, or '' when the user has none. */
  profileImageUrl: string
}

export function createEmptyProfile(): ProfileInfo {
  return {
    firstName: '',
    lastName: '',
    email: '',
    mobile: '',
    gender: null,
    dateOfBirth: '',
    profileImageUrl: '',
  }
}

export interface ProfileAddress {
  id: string
  type: AddressType
  fullName: string
  phone: string
  addressLine1: string
  addressLine2: string
  landmark: string
  city: string
  state: string
  postalCode: string
  country: string
  isDefault: boolean
}

export function createEmptyAddress(): ProfileAddress {
  return {
    id: '',
    type: 'home',
    fullName: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
    isDefault: false,
  }
}
