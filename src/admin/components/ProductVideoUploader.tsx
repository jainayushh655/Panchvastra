import { useRef, useState } from 'react'
import {
  ALLOWED_VIDEO_TYPES,
  MAX_VIDEO_BYTES,
  StorageUploadError,
  formatBytes,
  readVideoApiError,
  uploadProductVideo,
  validateVideoFile,
} from '@/api/productVideos'

/**
 * Video upload for ONE saved variant.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS SEPARATE FROM THE IMAGE PICKER
 * ──────────────────────────────────────────────────────────────────────────────
 * Two reasons, and both are hard constraints rather than preferences:
 *
 * 1. Videos must not go through the product create/update multipart form — that form is
 *    images-only and rejects a video. A video goes straight to object storage through a
 *    pre-signed URL and is then attached by id.
 *
 * 2. Attaching needs an EXISTING `variant_id`, which a variant being created for the
 *    first time does not have yet. So this control is disabled until the product has been
 *    saved, with the reason stated rather than the control silently doing nothing.
 *
 * The other consequence of the split: a video uploads IMMEDIATELY, before Save. Unlike an
 * image — which is held locally and sent with the form — a video exists on the variant the
 * moment the upload finishes. The copy below says so, because "I didn't save, so it didn't
 * happen" is a reasonable thing to assume and would be wrong here.
 *
 * Once attached, the video is an ordinary gallery item: it reorders with the existing
 * `variant_image_orders` field and deletes with `delete_variant_image_ids`, both on the
 * normal product save.
 */

type ProductVideoUploaderProps = {
  /** The variant's backend id. null for a variant that has not been saved yet. */
  variantId: number | null
  /** Re-reads the product so the new video appears in the gallery above. */
  onUploaded: () => void | Promise<void>
  disabled?: boolean
}

export function ProductVideoUploader({ variantId, onUploaded, disabled }: ProductVideoUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const unsaved = variantId === null

  const handleFile = async (file: File | null | undefined) => {
    if (!file || uploading) return

    setError(null)
    setNotice(null)

    // Checked before any request: the alternative is uploading tens of megabytes and only
    // then being told the type was wrong.
    const invalid = validateVideoFile(file)
    if (invalid) {
      setError(invalid)
      if (inputRef.current) inputRef.current.value = ''
      return
    }

    if (variantId === null) return

    const controller = new AbortController()
    abortRef.current = controller

    setUploading(true)
    setProgress(0)

    try {
      await uploadProductVideo({ variantId, file }, setProgress, controller.signal)
      setNotice('Video uploaded and attached to this variant.')
      await onUploaded()
    } catch (uploadError) {
      /*
       * A storage failure is reported with its own wording — most often the bucket has no
       * CORS rule for this origin, which is an ops task the admin cannot fix and should
       * not be told to "try again" about.
       */
      setError(
        uploadError instanceof StorageUploadError
          ? uploadError.message
          : readVideoApiError(uploadError, 'Could not upload this video.'),
      )
    } finally {
      abortRef.current = null
      setUploading(false)
      setProgress(0)
      // Reset so picking the same file again still fires `change`.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="admin-images">
      <span className="admin-variant__title">Video</span>

      {unsaved ? (
        <p className="admin-images__note">
          Save the product first. A video attaches to a variant that already exists, so it
          can only be added once this variant has been created.
        </p>
      ) : (
        <>
          <input
            ref={inputRef}
            className="admin-images__input"
            type="file"
            accept={ALLOWED_VIDEO_TYPES.join(',')}
            disabled={disabled || uploading}
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />

          {uploading ? (
            <div style={{ marginTop: '0.5rem' }}>
              {/*
                A real `<progress>` rather than a styled div, so assistive tech reports the
                percentage. A 50 MB upload with no feedback is indistinguishable from a
                hang, which is the whole reason this flow uses XMLHttpRequest.
              */}
              <progress value={progress} max={100} aria-label="Upload progress" style={{ width: '100%' }} />
              <p className="admin-muted">Uploading… {progress}%</p>
              <button
                type="button"
                className="admin-link-button admin-link-button--danger"
                onClick={() => abortRef.current?.abort()}
              >
                Cancel upload
              </button>
            </div>
          ) : null}

          <p className="admin-images__note">
            MP4, WebM or MOV, up to {formatBytes(MAX_VIDEO_BYTES)}. The video uploads
            straight away — it does not wait for Save. Reorder or remove it from the gallery
            above, then save as usual.
          </p>
        </>
      )}

      {notice ? <p className="admin-muted">{notice}</p> : null}
      {error ? (
        <p className="admin-form__error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
