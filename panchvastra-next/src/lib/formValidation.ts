import type { Address } from '@/types'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(value: string): string | null {
  const s = value.trim()
  if (!s) return 'Email is required.'
  if (!EMAIL_RE.test(s)) return 'Enter a valid email address.'
  return null
}

export function validatePasswordLogin(value: string): string | null {
  if (!value.trim()) return 'Password is required.'
  return null
}

/** Signup: at least 8 chars with a letter and a number. */
export function validatePasswordSignup(value: string): string | null {
  if (!value) return 'Password is required.'
  if (value.length < 8) return 'Use at least 8 characters.'
  if (!/[a-zA-Z]/.test(value)) return 'Include at least one letter.'
  if (!/[0-9]/.test(value)) return 'Include at least one number.'
  return null
}

export function validateName(value: string): string | null {
  const s = value.trim()
  if (!s) return 'Name is required.'
  if (s.length < 2) return 'Name must be at least 2 characters.'
  return null
}

/** Digits only after stripping spaces/dashes; 10-digit India mobile (optional +91). */
export function validatePhoneIndia(value: string): string | null {
  let d = value.replace(/\D/g, '')
  if (d.startsWith('91') && d.length === 12) d = d.slice(2)
  if (!d) return 'Phone number is required.'
  if (d.length !== 10) return 'Enter a valid 10-digit mobile number.'
  if (!/^[6-9]/.test(d)) return 'Enter a valid Indian mobile number (starts with 6–9).'
  return null
}

export function validateFullName(value: string): string | null {
  const s = value.trim()
  if (!s) return 'Full name is required.'
  if (s.length < 3) return 'Enter your full name.'
  return null
}

export function validateAddressLine1(value: string): string | null {
  const s = value.trim()
  if (!s) return 'Address is required.'
  if (s.length < 5) return 'Enter a complete street address.'
  return null
}

export function validateCity(value: string): string | null {
  const s = value.trim()
  if (!s) return 'City is required.'
  if (s.length < 2) return 'Enter a valid city.'
  return null
}

export function validateState(value: string): string | null {
  const s = value.trim()
  if (!s) return 'State is required.'
  if (s.length < 2) return 'Enter a valid state.'
  return null
}

/** Optional field: valid calendar date, not in the future. */
export function validateDateOfBirth(value: string): string | null {
  const s = value.trim()
  if (!s) return null
  const date = new Date(s)
  if (Number.isNaN(date.getTime())) return 'Enter a valid date.'
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  if (date > endOfToday) return 'Date of birth cannot be in the future.'
  return null
}

export function validateIndianPincode(value: string): string | null {
  const d = value.replace(/\D/g, '')
  if (!d) return 'PIN code is required.'
  if (d.length !== 6) return 'PIN must be exactly 6 digits.'
  return null
}

export type AddressFieldErrors = Partial<Record<keyof Address, string>>

export function validateCheckoutAddress(a: Address): AddressFieldErrors {
  const errors: AddressFieldErrors = {}
  const em = validateEmail(a.email)
  if (em) errors.email = em
  const fn = validateFullName(a.fullName)
  if (fn) errors.fullName = fn
  const l1 = validateAddressLine1(a.line1)
  if (l1) errors.line1 = l1
  const c = validateCity(a.city)
  if (c) errors.city = c
  const st = validateState(a.state)
  if (st) errors.state = st
  const pin = validateIndianPincode(a.pincode)
  if (pin) errors.pincode = pin
  const ph = validatePhoneIndia(a.phone)
  if (ph) errors.phone = ph
  return errors
}

export function hasAddressErrors(e: AddressFieldErrors): boolean {
  return Object.keys(e).length > 0
}
