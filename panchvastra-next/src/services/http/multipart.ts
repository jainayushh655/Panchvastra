/**
 * Multipart upload conventions — ported verbatim from the Vite application.
 *
 * The migration audit rated the product-image contract the single highest-risk piece of
 * code in the repository: it pairs two repeated multipart fields BY POSITION, and a
 * well-meaning refactor silently corrupts image ordering rather than failing loudly. It
 * lives here, in the foundation, so the services ported in later phases import it instead
 * of each re-deriving it.
 *
 * Six surfaces in the application upload files: product images, category image,
 * auth-carousel image, custom-option image, custom-request reference file, and the profile
 * avatar. All of them rely on `multipartConfig()` below.
 */

import { adminAuthConfig } from './adminRequest'

/**
 * Config for a multipart ADMIN write.
 *
 * `Content-Type` is explicitly set to `undefined` so the browser generates the multipart
 * boundary itself. This is not stylistic: setting the header to `"multipart/form-data"`
 * by hand omits the `boundary=` parameter, and the request then fails to parse
 * server-side. The shared client sets `application/json` as its default header, so it
 * MUST be unset per-request here.
 *
 * The admin Authorization header is unchanged and still comes from `adminAuthConfig`.
 */
export function multipartConfig() {
  const config = adminAuthConfig()
  return { ...config, headers: { ...config.headers, 'Content-Type': undefined } }
}

/**
 * Config for a multipart CUSTOMER write (profile avatar, custom-request reference file).
 *
 * No explicit Authorization header: the shared client's request interceptor attaches the
 * customer token. Only `Content-Type` is unset, for the boundary reason above.
 */
export function customerMultipartConfig() {
  return { headers: { 'Content-Type': undefined } }
}

/**
 * New image files to upload, keyed by the variant's ZERO-BASED POSITION in the payload's
 * `variants` array — **not** by variant id. The backend reads `variant_<index>_images`,
 * so the key is a position in the array being submitted, and a new (unsaved) variant has
 * no id to key by in the first place.
 */
export type VariantImageFiles = Map<number, File[]>

/**
 * 1-based `display_order` for each new file, keyed by the same variant index and held in
 * the SAME order as that variant's entry in `VariantImageFiles` — entry `n` here is the
 * order for file `n` there. Sent as repeated `variant_<index>_image_orders` fields.
 */
export type VariantImageOrders = Map<number, number[]>

/**
 * Builds the multipart body the product image contract specifies: the whole product
 * payload as a JSON string under `data`, then every file appended under
 * `variant_<index>_images`.
 *
 * Two things here are easy to break and must not change:
 *
 *  1. Several files share ONE field name (`variant_0_images` repeated). That is how the
 *     backend receives a list. Appending them as `variant_0_images[0]`, `[1]`, … does not
 *     work.
 *
 *  2. Each order is appended in the SAME loop iteration as its file, so the two repeated
 *     fields stay positionally aligned. The backend pairs them by position, not by name.
 *     Appending all files and then all orders happens to produce the same body today, but
 *     only by accident of iteration order — doing it in one pass makes the invariant
 *     structural.
 *
 * Images never appear inside the JSON: no `images` key is added to any variant.
 */
export function toProductFormData(
  payload: unknown,
  images: VariantImageFiles,
  imageOrders?: VariantImageOrders,
): FormData {
  const formData = new FormData()
  formData.append('data', JSON.stringify(payload))

  for (const [index, files] of images) {
    const orders = imageOrders?.get(index)

    files.forEach((file, position) => {
      formData.append(`variant_${index}_images`, file)

      const order = orders?.[position]
      if (order !== undefined) {
        formData.append(`variant_${index}_image_orders`, String(order))
      }
    })
  }

  return formData
}

/** True when any variant actually has a file to upload — decides JSON vs multipart. */
export function hasFiles(images: VariantImageFiles | undefined): boolean {
  if (!images) return false
  for (const files of images.values()) {
    if (files.length) return true
  }
  return false
}

/**
 * Flattens a plain object into `FormData` for the endpoints that accept ONLY multipart
 * (categories, auth carousel, custom options).
 *
 * Rules, each one load-bearing somewhere:
 *   - `undefined` is SKIPPED, not sent as the string "undefined". An omitted key means
 *     "leave the stored value alone" on this backend, so sending a placeholder would
 *     overwrite it.
 *   - `null` IS sent, as the empty string, because that is how those endpoints clear a
 *     field.
 *   - An array is appended once PER ITEM under the same key (`colour_ids` repeated), which
 *     is what the custom-options endpoint documents.
 *   - A `File` is appended as-is so the browser streams it.
 *   - A boolean becomes `"true"`/`"false"`, which Django's form parsing expects.
 */
export function toFormData(payload: Record<string, unknown>): FormData {
  const formData = new FormData()

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue

    if (value === null) {
      formData.append(key, '')
      continue
    }

    if (value instanceof File || value instanceof Blob) {
      formData.append(key, value)
      continue
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        if (entry === undefined || entry === null) continue
        formData.append(key, entry instanceof File || entry instanceof Blob ? entry : String(entry))
      }
      continue
    }

    if (typeof value === 'boolean') {
      formData.append(key, value ? 'true' : 'false')
      continue
    }

    formData.append(key, String(value))
  }

  return formData
}
