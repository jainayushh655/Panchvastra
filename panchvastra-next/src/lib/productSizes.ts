/**
 * Variant sizes — the default rows a new variant starts with, and the checks run before a
 * product is saved.
 *
 * Sizes belong to a VARIANT, not to a product: the write contract nests
 * `variants[].sizes[]`, and `ProductVariantSizeRequest` in the published schema is
 * `{ id?, size, stock_quantity, is_active? }` with `stock_quantity` documented as
 * `minimum: 0`. So zero stock is a legitimate saved value, not an "empty" row, and nothing
 * here treats it as one.
 *
 * This module is deliberately shaped like `keyHighlights.ts`: the defaults live in one
 * array that the admin form seeds from, and validation is a pure function the save handler
 * calls. Neither is duplicated in JSX.
 */

/** The row shape these helpers need. The form's own `SizeForm` carries more and still fits. */
export type SizeRow = {
  size: string
  stock_quantity: string
}

/**
 * The sizes a NEW variant starts with, in this exact order.
 *
 * An authoring convenience only. The admin form applies it when opening the CREATE form
 * and when adding a new variant — never when loading a saved product — so it can never
 * merge itself into stored data, and it is never sent to the backend as a default.
 */
export const DEFAULT_SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const

/** `size` is capped at 20 characters by the published write contract. */
export const SIZE_NAME_MAX = 20

/**
 * Stock must be a whole number of zero or more.
 *
 * Checked on the RAW string rather than on `Number(...)`, because `Number` happily accepts
 * "1e3", " 12 " and "1.0", and `parseInt` would silently truncate "1.9" to 1. A saved
 * quantity should be exactly what the admin typed.
 */
function readStock(raw: string): number | null {
  const text = raw.trim()
  if (!/^\d+$/.test(text)) return null
  const value = Number(text)
  return Number.isSafeInteger(value) ? value : null
}

/**
 * The first problem with a variant's sizes, or `null` when they are all fine.
 *
 * Mirrors `validateKeyHighlights`: one message at a time, naming the row so the admin can
 * find it. `variantLabel` is the "Variant 2" prefix the surrounding save handler already
 * uses for its other messages.
 */
export function validateSizes(rows: readonly SizeRow[], variantLabel: string): string | null {
  if (rows.length === 0) return `${variantLabel} needs at least one size.`

  const seen = new Map<string, number>()
  let named = 0

  for (let index = 0; index < rows.length; index += 1) {
    const size = rows[index].size.trim()
    const position = index + 1

    if (!size) return `${variantLabel}, size ${position} needs a name.`
    if (size.length > SIZE_NAME_MAX) {
      return `${variantLabel}, size ${position} ("${size}") is longer than ${SIZE_NAME_MAX} characters.`
    }

    // Case- and whitespace-insensitive, so " m " cannot be saved alongside "M".
    const key = size.toLowerCase()
    const first = seen.get(key)
    if (first !== undefined) {
      return `${variantLabel} lists "${size}" twice (sizes ${first + 1} and ${position}). Each size must appear once.`
    }
    seen.set(key, index)
    named += 1

    if (readStock(rows[index].stock_quantity) === null) {
      return `${variantLabel}, size ${position} ("${size}") needs a stock quantity of 0 or more, as a whole number.`
    }
  }

  if (named === 0) return `${variantLabel} needs at least one size.`

  return null
}
