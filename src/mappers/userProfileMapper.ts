import { GENDER_VALUES, type GenderValue, type UserProfileDto } from '@/types/api/UserProfileDto'
import type { ProfileInfo } from '@/lib/mockProfile'

/** Case-insensitive match against the backend's `GenderEnum`; anything else becomes null. */
function toGender(value: string | null | undefined): GenderValue | null {
  const normalized = (value ?? '').trim().toLowerCase()
  return GENDER_VALUES.find((g) => g.toLowerCase() === normalized) ?? null
}

/** Keeps only a valid ISO `YYYY-MM-DD`; tolerates a full datetime by taking the date part. */
function toIsoDate(value: string | null | undefined): string {
  const raw = (value ?? '').trim()
  if (!raw) return ''
  const datePart = raw.slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(datePart) ? datePart : ''
}

/**
 * Resolves a stored image path. Absolute URLs are used as-is; a relative path is resolved
 * against the configured API base when there is one. A path that still can't be resolved
 * is rendered through the avatar fallback rather than as a broken image.
 */
function toImageUrl(value: string | null | undefined): string {
  const raw = (value ?? '').trim()
  if (!raw) return ''
  if (/^(https?:)?\/\//i.test(raw) || raw.startsWith('data:')) return raw

  const base = (import.meta.env.VITE_API_BASE_URL ?? '').trim()
  if (!base) return raw

  return `${base.replace(/\/+$/, '')}/${raw.replace(/^\/+/, '')}`
}

/**
 * API record → the camelCase model the Profile UI consumes.
 *
 * `fallbackEmail` is the signed-in session's email, used only when the profile payload
 * does not carry one — email is display-only and never submitted.
 */
export function mapUserProfile(dto: UserProfileDto, fallbackEmail = ''): ProfileInfo {
  return {
    firstName: (dto.first_name ?? '').trim(),
    lastName: (dto.last_name ?? '').trim(),
    email: (dto.email ?? '').trim() || fallbackEmail.trim(),
    mobile: (dto.mobile ?? '').trim(),
    gender: toGender(dto.gender),
    dateOfBirth: toIsoDate(dto.date_of_birth),
    profileImageUrl: toImageUrl(dto.profile_image),
  }
}

/**
 * UI model → the multipart body for PUT /v1/user_profile/.
 *
 * Which fields are appended follows the backend's published schema
 * (`UpdateUserProfileRequest`):
 *   - `first_name` (minLength 1) and `mobile` (minLength 1) reject blanks, so they are
 *     omitted when empty rather than sent as ''.
 *   - `last_name` has no minLength (blank allowed) and is always sent.
 *   - `date_of_birth` and `gender` are `nullable`, so '' is sent to clear them — the
 *     standard form representation of null.
 *   - `email` is not part of the contract and is never appended.
 *   - `profile_image` is appended only when the user actually picked a file, so an
 *     existing image is left untouched.
 */
export function toProfileFormData(profile: ProfileInfo, imageFile: File | null): FormData {
  const formData = new FormData()

  const firstName = profile.firstName.trim()
  if (firstName) formData.append('first_name', firstName)

  formData.append('last_name', profile.lastName.trim())

  const mobile = profile.mobile.trim()
  if (mobile) formData.append('mobile', mobile)

  formData.append('date_of_birth', profile.dateOfBirth.trim())
  formData.append('gender', profile.gender ?? '')

  if (imageFile) formData.append('profile_image', imageFile)

  return formData
}
