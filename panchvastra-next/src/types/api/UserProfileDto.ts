/**
 * User Profile contract for /v1/user_profile/.
 *
 * Field names and constraints below are taken from the backend's own published OpenAPI
 * schema (GET https://api.panchvastra.com/api/schema/ → `UpdateUserProfileRequest`,
 * `GenderEnum`), not guessed.
 */

/** The only gender values the backend accepts (`GenderEnum`), plus null. */
export const GENDER_VALUES = ['Male', 'Female', 'Other'] as const

export type GenderValue = (typeof GENDER_VALUES)[number]

/**
 * Profile record as returned by GET /v1/user_profile/.
 *
 * The schema documents the GET as "No response body", so the exact payload is not
 * published; these are the field names the PUT contract defines, read defensively.
 */
export interface UserProfileDto {
  first_name?: string | null
  last_name?: string | null
  /** Present on the backend user record; the PUT contract cannot change it. */
  email?: string | null
  mobile?: string | null
  /** ISO `YYYY-MM-DD` (schema `type: string, format: date`), nullable. */
  date_of_birth?: string | null
  gender?: string | null
  /** Absolute or relative URL of the stored image. */
  profile_image?: string | null
}
