import { useEffect, useRef } from 'react'
import type { VariantImageDto } from '@/types/api/ProductDetailDto'

/**
 * A newly picked image, held locally until the product is saved.
 *
 * `previewUrl` is an object URL — it must be revoked when the entry goes away, which the
 * uploader below handles on removal and on unmount.
 */
export type PendingImage = {
  /** Local-only key. Never sent anywhere; existing images are identified by their real id. */
  key: string
  file: File
  previewUrl: string
}

let pendingSeq = 0
const nextKey = () => `pending-${++pendingSeq}`

/** Wraps picked files as pending entries, splitting out anything that is not an image. */
export function toPendingImages(files: FileList | File[]): { accepted: PendingImage[]; rejected: string[] } {
  const accepted: PendingImage[] = []
  const rejected: string[] = []

  for (const file of Array.from(files)) {
    // Only a type check — no size or dimension limits are invented, because the backend
    // contract does not specify any.
    if (file.type && file.type.startsWith('image/')) {
      accepted.push({ key: nextKey(), file, previewUrl: URL.createObjectURL(file) })
    } else {
      rejected.push(file.name)
    }
  }

  return { accepted, rejected }
}

/**
 * Multi-image picker for one product variant.
 *
 * Images belong to variants in this backend: GET /v1/products_management/ returns
 * `variants[].images[]` as `{ id, image_url, display_order }`, so that relationship is
 * mirrored here rather than inventing a product-level one.
 *
 * Existing images are shown read-only. The product write contract currently exposes no
 * image field at all — including no deletion array — so this component deliberately offers
 * no delete control for them rather than implying support that does not exist.
 */
export function ProductImageUploader({
  variantIndex,
  existingImages,
  pendingImages,
  onAdd,
  onRemovePending,
  disabled,
}: {
  variantIndex: number
  existingImages: VariantImageDto[]
  pendingImages: PendingImage[]
  onAdd: (files: FileList) => void
  onRemovePending: (key: string) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Release object URLs for whatever is still pending when this variant unmounts. The ref
  // is kept current in an effect so nothing mutates it during render.
  const pendingRef = useRef(pendingImages)
  useEffect(() => {
    pendingRef.current = pendingImages
  }, [pendingImages])
  useEffect(() => {
    return () => {
      for (const image of pendingRef.current) URL.revokeObjectURL(image.previewUrl)
    }
  }, [])

  const inputId = `variant-images-${variantIndex}`
  const ordered = [...existingImages].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))

  return (
    <div className="admin-images">
      <span className="admin-variant__title">Images</span>

      {ordered.length || pendingImages.length ? (
        <ul className="admin-images__grid">
          {/* Existing images keep the backend's display_order. */}
          {ordered.map((image) => (
            <li className="admin-images__item" key={`existing-${image.id}`}>
              <img src={image.image_url} alt="" loading="lazy" />
              <span className="admin-images__tag">Saved</span>
            </li>
          ))}

          {pendingImages.map((image) => (
            <li className="admin-images__item admin-images__item--new" key={image.key}>
              <img src={image.previewUrl} alt="" />
              <span className="admin-images__tag admin-images__tag--new">New</span>
              <button
                type="button"
                className="admin-images__remove"
                onClick={() => onRemovePending(image.key)}
                aria-label={`Remove selected image ${image.file.name}`}
                disabled={disabled}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-images__empty">No images selected yet.</p>
      )}

      <input
        ref={inputRef}
        id={inputId}
        className="admin-images__input"
        type="file"
        accept="image/*"
        multiple
        disabled={disabled}
        onChange={(event) => {
          const files = event.target.files
          if (files && files.length) onAdd(files)
          // Reset so picking the same file again still fires a change event.
          event.target.value = ''
        }}
      />
      <button
        type="button"
        className="admin-link-button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
      >
        {ordered.length || pendingImages.length ? '+ Add more images' : '+ Add images'}
      </button>

      {/* Stated plainly rather than letting an admin believe a selection was stored: the
          product write API exposes no image field yet, so saving cannot include these. */}
      <p className="admin-images__note">
        Selected images are previewed here only — the product API does not accept image uploads yet,
        so they are not sent when you save.
      </p>
    </div>
  )
}
