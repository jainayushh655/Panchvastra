import { useEffect, useRef, useState } from 'react'
import { compressImages } from '@/admin/utils/imageCompression'
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

export type PendingImageSelection = {
  accepted: PendingImage[]
  rejected: string[]
  /** Total bytes of the accepted files as picked, and as they will actually be uploaded. */
  originalBytes: number
  uploadBytes: number
  /**
   * How many accepted files were ACTUALLY re-encoded.
   *
   * Not the same as `accepted.length`: a file already under the skip threshold, a GIF, or
   * one whose re-encode came out no smaller is passed through untouched. Reporting the
   * accepted count as the optimised count would overstate what happened, so the two are
   * kept apart and the admin notice uses this one.
   */
  optimisedCount: number
}

/**
 * Wraps picked files as pending entries, splitting out anything that is not an image —
 * and re-encodes each accepted one before it is ever queued for upload.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THE COMPRESSION BELONGS HERE AND NOT AT THE CALL SITE
 * ──────────────────────────────────────────────────────────────────────────────
 * This is the ONE place a picked file becomes a `PendingImage`, which is the only thing
 * the save path ever uploads. Compressing here means every current and future entry point
 * — the file input, a drag and drop, a paste — is covered, and no caller can forget.
 *
 * The type check is unchanged and still the only thing that can REJECT a file. The
 * backend contract specifies no size limit and none is invented: an oversized file is
 * still accepted, it is simply sent as a fraction of the bytes. See `compressImage` for
 * what the catalogue looked like without this, and for why every failure path returns the
 * original file rather than refusing it.
 *
 * `previewUrl` is deliberately built from the COMPRESSED file — it is what will be
 * stored, so the admin's preview is a true picture of the result rather than of the
 * source they picked.
 */
export async function toPendingImages(files: FileList | File[]): Promise<PendingImageSelection> {
  const rejected: string[] = []
  const images: File[] = []

  for (const file of Array.from(files)) {
    // Only a type check — no size or dimension limits are invented, because the backend
    // contract does not specify any.
    if (file.type && file.type.startsWith('image/')) {
      images.push(file)
    } else {
      rejected.push(file.name)
    }
  }

  const { results, originalBytes, compressedBytes } = await compressImages(images)

  const accepted = results.map((result) => ({
    key: nextKey(),
    file: result.file,
    previewUrl: URL.createObjectURL(result.file),
  }))

  return {
    accepted,
    rejected,
    originalBytes,
    uploadBytes: compressedBytes,
    optimisedCount: results.filter((result) => result.changed).length,
  }
}

/**
 * One slot in a variant's single ordered image list.
 *
 * A saved image is always addressed by its real backend id and a new one by its local key —
 * an array index is never used as an identity, so reordering cannot corrupt either.
 */
export type VariantImageEntry =
  | { token: string; kind: 'existing'; image: VariantImageDto }
  | { token: string; kind: 'new'; pending: PendingImage }

export const existingToken = (imageId: number) => `e:${imageId}`
export const pendingToken = (key: string) => `n:${key}`

/**
 * Resolves the two stored lists plus a saved token order into ONE ordered list.
 *
 * `order` holds only tokens, so it survives re-renders and never duplicates image data.
 * Anything the order does not mention — a just-picked file, or an image on first load
 * before the admin has dragged anything — is appended in the default arrangement
 * (existing by the backend's `display_order`, then newly picked in selection order), which
 * is exactly what the gallery showed before this feature existed. Tokens that no longer
 * resolve (a removed image) simply drop out, so the list is self-healing.
 */
export function buildImageEntries(
  existingImages: VariantImageDto[],
  pendingImages: PendingImage[],
  order: string[],
): VariantImageEntry[] {
  const base: VariantImageEntry[] = [
    ...[...existingImages]
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((image): VariantImageEntry => ({ token: existingToken(image.id), kind: 'existing', image })),
    ...pendingImages.map((pending): VariantImageEntry => ({
      token: pendingToken(pending.key),
      kind: 'new',
      pending,
    })),
  ]

  const byToken = new Map(base.map((entry) => [entry.token, entry]))
  const seen = new Set<string>()
  const ordered: VariantImageEntry[] = []

  for (const token of order) {
    const entry = byToken.get(token)
    if (entry && !seen.has(token)) {
      seen.add(token)
      ordered.push(entry)
    }
  }
  for (const entry of base) {
    if (!seen.has(entry.token)) ordered.push(entry)
  }

  return ordered
}

/** Moves one entry to a new index, returning the resulting token order. */
export function reorderTokens(entries: VariantImageEntry[], from: number, to: number): string[] {
  const tokens = entries.map((entry) => entry.token)
  if (from === to || from < 0 || to < 0 || from >= tokens.length || to >= tokens.length) return tokens
  const [moved] = tokens.splice(from, 1)
  tokens.splice(to, 0, moved)
  return tokens
}

/**
 * Multi-image picker for one product variant.
 *
 * Images belong to variants in this backend: GET /v1/products_management/ returns
 * `variants[].images[]` as `{ id, image_url, display_order }`, so that relationship is
 * mirrored here rather than inventing a product-level one.
 *
 * Existing images keep their backend id. Removing one does NOT call an API immediately — the
 * id is tracked by the page and sent as `delete_variant_image_ids` on save, so nothing is
 * destroyed until the admin actually saves.
 */
export function ProductImageUploader({
  variantIndex,
  existingImages,
  pendingImages,
  imageOrder,
  onAdd,
  onRemovePending,
  onRemoveExisting,
  onReorder,
  disabled,
}: {
  variantIndex: number
  existingImages: VariantImageDto[]
  pendingImages: PendingImage[]
  /** Saved token order for this variant; empty until the admin drags something. */
  imageOrder: string[]
  onAdd: (files: FileList) => void
  onRemovePending: (key: string) => void
  /** Marks a saved image for deletion on the next save. */
  onRemoveExisting: (imageId: number) => void
  /** Receives the full token order after a drag. */
  onReorder: (tokens: string[]) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  /** Index being dragged, and the index it would land on. UI feedback only. */
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  /**
   * The authoritative drag source. State is not readable synchronously, and `drop` can fire
   * in the same tick as `dragstart`, so the index is mirrored here — the state above exists
   * only to drive the visual feedback.
   */
  const dragIndexRef = useRef<number | null>(null)

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
  // Saved and new images live in ONE ordered list, so either kind can be dragged anywhere.
  const entries = buildImageEntries(existingImages, pendingImages, imageOrder)

  const dropAt = (to: number) => {
    const from = dragIndexRef.current
    if (from === null || from === to) return
    onReorder(reorderTokens(entries, from, to))
  }

  const endDrag = () => {
    dragIndexRef.current = null
    setDragIndex(null)
    setOverIndex(null)
  }

  /** Keyboard equivalent of a drag, so ordering is not mouse-only. */
  const nudge = (from: number, delta: number) => {
    const to = from + delta
    if (to < 0 || to >= entries.length) return
    onReorder(reorderTokens(entries, from, to))
  }

  return (
    <div className="admin-images">
      <span className="admin-variant__title">Images</span>

      {entries.length ? (
        <ul className="admin-images__grid">
          {entries.map((entry, index) => {
            const isNew = entry.kind === 'new'
            const label = isNew ? entry.pending.file.name : `saved image ${entry.image.id}`

            return (
              <li
                key={entry.token}
                // Position in this list IS the order; it is turned into a 1-based
                // display_order at save time.
                className={[
                  'admin-images__item',
                  isNew ? 'admin-images__item--new' : '',
                  dragIndex === index ? 'admin-images__item--dragging' : '',
                  overIndex === index && dragIndex !== index ? 'admin-images__item--dropzone' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                draggable={!disabled}
                aria-label={`Image ${index + 1} of ${entries.length}: ${label}`}
                tabIndex={disabled ? -1 : 0}
                onDragStart={(event) => {
                  dragIndexRef.current = index
                  setDragIndex(index)
                  event.dataTransfer.effectAllowed = 'move'
                  // Firefox starts no drag at all unless some data is set.
                  event.dataTransfer.setData('text/plain', entry.token)
                }}
                onDragEnter={() => setOverIndex(index)}
                onDragOver={(event) => {
                  // Only preventDefault marks this a valid drop target.
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  dropAt(index)
                  endDrag()
                }}
                onDragEnd={endDrag}
                onKeyDown={(event) => {
                  if (disabled) return
                  if (event.key === 'ArrowLeft') {
                    event.preventDefault()
                    nudge(index, -1)
                  } else if (event.key === 'ArrowRight') {
                    event.preventDefault()
                    nudge(index, 1)
                  }
                }}
                style={{
                  cursor: disabled ? undefined : 'grab',
                  opacity: dragIndex === index ? 0.45 : undefined,
                  outline: overIndex === index && dragIndex !== index ? '2px solid #000' : undefined,
                  outlineOffset: overIndex === index && dragIndex !== index ? '2px' : undefined,
                }}
              >
                {/*
                  Rendered by `media_type`, not by guessing from the URL. A variant's
                  gallery is now a mixed list, and feeding a video URL to an `<img>` draws
                  a broken-image icon — a silent, confusing failure in the one screen where
                  the admin is checking their media is right.

                  `preload="metadata"` fetches just enough to paint a first frame; `muted`
                  keeps a grid of clips silent.
                */}
                {!isNew && entry.image.media_type === 'VIDEO' ? (
                  <video
                    src={entry.image.image_url}
                    muted
                    playsInline
                    preload="metadata"
                    // Must not become its own drag source, or the card's dragstart never
                    // fires in some browsers.
                    draggable={false}
                  />
                ) : (
                  <img
                    src={isNew ? entry.pending.previewUrl : entry.image.image_url}
                    alt=""
                    loading={isNew ? undefined : 'lazy'}
                    draggable={false}
                  />
                )}
                <span className={isNew ? 'admin-images__tag admin-images__tag--new' : 'admin-images__tag'}>
                  {isNew ? 'New' : !isNew && entry.image.media_type === 'VIDEO' ? 'Video' : 'Saved'}
                </span>
                <button
                  type="button"
                  className="admin-images__remove"
                  // Keeps the X a plain click: without this the button itself becomes part
                  // of the draggable card and a click can be swallowed by a drag.
                  draggable={false}
                  onDragStart={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                  }}
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (isNew) onRemovePending(entry.pending.key)
                    else onRemoveExisting(entry.image.id)
                  }}
                  aria-label={
                    isNew
                      ? `Remove selected image ${entry.pending.file.name}`
                      : `Remove saved image ${entry.image.id}`
                  }
                  disabled={disabled}
                >
                  ×
                </button>
              </li>
            )
          })}
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
        {entries.length ? '+ Add more images' : '+ Add images'}
      </button>

      <p className="admin-images__note">Images are uploaded when you save this product.</p>
    </div>
  )
}
