/**
 * DEV-ONLY mock data and types for the Profile + Address Book UI.
 *
 * There is no Profile or Address backend/API yet. This file is the isolated,
 * clearly-named local source powering that UI until a real API exists — it is not
 * imported by any API file, auth state, cart state, or checkout state. When the
 * backend is ready, replace the local `useState` seeded from this file in
 * `ProfilePage` with real GET/CREATE/UPDATE/DELETE calls; the component props
 * (`ProfileInfo`, `ProfileAddress`) are shaped so the rest of the UI doesn't change.
 */

export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say'

export const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

export type AddressType = 'home' | 'work' | 'other'

export const ADDRESS_TYPE_OPTIONS: { value: AddressType; label: string }[] = [
  { value: 'home', label: 'Home' },
  { value: 'work', label: 'Work' },
  { value: 'other', label: 'Other' },
]

export interface ProfileInfo {
  fullName: string
  email: string
  phone: string
  gender: Gender | null
  /** ISO `YYYY-MM-DD`, or '' when not set. */
  dateOfBirth: string
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

/** Seed data so the Address Book UI has something to render during development. */
export const MOCK_ADDRESSES: ProfileAddress[] = [
  {
    id: 'addr-mock-home',
    type: 'home',
    fullName: 'Kunal Kumawat',
    phone: '9876543210',
    addressLine1: '123, Example Street',
    addressLine2: 'Vijay Nagar',
    landmark: 'Near City Mall',
    city: 'Indore',
    state: 'Madhya Pradesh',
    postalCode: '452001',
    country: 'India',
    isDefault: true,
  },
]
