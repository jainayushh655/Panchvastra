import api from './axios'
import { adminAuthConfig, MissingAdminSessionError } from './adminRequest'
import type { MediaType } from '@/types/api/ProductDetailDto'

export { MissingAdminSessionError }

/**
 * Product videos — a three-step, direct-to-storage upload.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY NOT THE PRODUCT FORM
 * ──────────────────────────────────────────────────────────────────────────────
 * Videos must NOT go through the product create/update multipart form. That form stays
 * images-only and rejects a video outright. A 50 MB file through an application request
 * would hold a worker open for the whole upload and hit request-size limits; a pre-signed
 * URL lets the browser talk to object storage directly and keeps the API out of the
 * data path entirely.
 *
 * The sequence, which only works on an EXISTING variant (so: after the product is
 * created, or on the edit screen):
 *
 *   1. `POST /v1/product_videos/upload_url/`  → a pre-signed PUT url and a `file_id`
 *   2. `PUT <upload_url>`                     → the raw file, straight to storage
 *   3. `POST /v1/product_videos/`             → attach `file_id` to a variant
 *
 * Step 2 is the one with the rule that is easy to get wrong: send the file as the raw
 * body with EXACTLY the headers step 1 returned, and nothing else. An `Authorization`
 * header, or any extra header, changes the signature the storage provider computed and
 * the upload is rejected. That is also why it does not use the shared axios client — the
 * request interceptor would attach the customer token automatically.
 *
 * After step 3 the video is an ordinary gallery item of the variant: reorder it with the
 * existing `variant_image_orders` field on product update, remove it with
 * `delete_variant_image_ids`.
 */

const UPLOAD_URL_PATH = '/v1/product_videos/upload_url/'
const ATTACH_PATH = '/v1/product_videos/'

/** Content types the backend accepts. Checked client-side so a bad pick fails instantly. */
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'] as const

/** 50 MB, mirrored from the backend limit. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

type Envelope<T> = { success?: boolean; message?: unknown; data?: T }

export interface VideoUploadTicket {
  upload_url: string
  method: 'PUT'
  /** Send these verbatim on the PUT, and nothing else. */
  headers: Record<string, string>
  file_id: string
  public_url: string
  /** Seconds the signed URL stays valid — 900 (15 minutes). */
  expires_in: number
  max_bytes: number
}

export interface ProductVideoDto {
  id: number
  variant_id: number
  /** Same field name images use, so the gallery reads one property for both. */
  image_url: string
  media_type: MediaType
  display_order: number
}

/* ------------------------------------------------------------------ messages */

export function readVideoApiMessage(message: unknown, fallback: string): string {
  if (typeof message === 'string' && message.trim()) return message.trim()

  if (message && typeof message === 'object') {
    const parts: string[] = []
    for (const [field, value] of Object.entries(message as Record<string, unknown>)) {
      const texts = Array.isArray(value)
        ? value.filter((v): v is string => typeof v === 'string')
        : typeof value === 'string'
          ? [value]
          : []
      for (const text of texts) parts.push(field === 'detail' ? text : `${field}: ${text}`)
    }
    if (parts.length) return parts.join(' ')
  }

  return fallback
}

export function readVideoApiError(error: unknown, fallback: string): string {
  if (error instanceof MissingAdminSessionError) return error.message
  if (error instanceof StorageUploadError) return error.message

  const response = (error as { response?: { status?: number; data?: Envelope<unknown> } }).response
  if (!response) return 'Unable to connect to the server. Check your connection and try again.'

  const status = response.status
  if (status && status >= 500) return 'The server is temporarily unavailable. Please try again shortly.'

  const message = readVideoApiMessage(response.data?.message, '')
  if (message) return message

  if (status === 401) return 'Your admin session has expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to manage product media.'
  if (status === 404) return 'That variant could not be found.'
  if (status === 409) return 'That video is already attached to this variant.'

  return fallback
}

/** Raised by step 2, so a storage/CORS failure is distinguishable from an API failure. */
export class StorageUploadError extends Error {
  /** True when the browser gave us no status at all — the signature of a CORS block. */
  readonly isLikelyCors: boolean

  constructor(message: string, { isLikelyCors = false }: { isLikelyCors?: boolean } = {}) {
    super(message)
    this.name = 'StorageUploadError'
    this.isLikelyCors = isLikelyCors
  }
}

/* ------------------------------------------------------------------ validation */

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

/**
 * Checks a file before any request is made.
 *
 * Worth doing client-side specifically because the alternative is uploading tens of
 * megabytes and only then being told the type was wrong.
 */
export function validateVideoFile(file: File): string | null {
  const type = file.type?.toLowerCase() ?? ''

  if (!ALLOWED_VIDEO_TYPES.includes(type as (typeof ALLOWED_VIDEO_TYPES)[number])) {
    return 'Videos must be MP4, WebM or MOV.'
  }

  if (file.size > MAX_VIDEO_BYTES) {
    return `This video is ${formatBytes(file.size)}. The limit is ${formatBytes(MAX_VIDEO_BYTES)}.`
  }

  if (file.size === 0) return 'That file is empty.'

  return null
}

/* ------------------------------------------------------------------ step 1 */

/** `POST /v1/product_videos/upload_url/` — asks for a pre-signed PUT url. */
export async function requestVideoUploadUrl(file: File): Promise<VideoUploadTicket> {
  const response = await api.post<Envelope<VideoUploadTicket>>(
    UPLOAD_URL_PATH,
    { content_type: file.type, file_size: file.size },
    adminAuthConfig(),
  )

  const ticket = response.data?.data
  if (!ticket?.upload_url || !ticket?.file_id) {
    // Fail closed rather than attempting an upload to an address we could not read.
    throw new Error('The server did not return an upload location. Please try again.')
  }

  return ticket
}

/* ------------------------------------------------------------------ step 2 */

/**
 * `PUT <upload_url>` — the raw file, straight to object storage.
 *
 * `XMLHttpRequest` rather than `fetch` purely for `upload.onprogress`: a 50 MB upload with
 * no progress bar looks indistinguishable from a hang, and `fetch` still has no portable
 * upload-progress event.
 *
 * ONLY the ticket's own headers are sent. No `Authorization`, nothing added — the URL
 * carries its own signature and an extra header invalidates it.
 */
export function uploadVideoToStorage(
  ticket: VideoUploadTicket,
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open(ticket.method ?? 'PUT', ticket.upload_url, true)

    for (const [name, value] of Object.entries(ticket.headers ?? {})) {
      request.setRequestHeader(name, value)
    }

    request.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)))
    }

    request.onload = () => {
      if (request.status >= 200 && request.status < 300) {
        onProgress?.(100)
        resolve()
        return
      }

      reject(
        new StorageUploadError(
          `Storage rejected the upload (HTTP ${request.status}). The signed URL may have expired — it is valid for ${Math.round(
            (ticket.expires_in ?? 900) / 60,
          )} minutes. Please try again.`,
        ),
      )
    }

    /*
     * A browser reports a blocked cross-origin request as a plain network error with no
     * status, which is indistinguishable here from the connection genuinely dropping. By
     * far the most common cause at this step is the storage bucket not having CORS
     * configured for this origin — an ops task, not something the admin can fix — so the
     * message says so instead of suggesting a pointless retry.
     */
    request.onerror = () => {
      reject(
        new StorageUploadError(
          'The upload could not reach storage. This is usually because the storage bucket has not been configured to accept uploads from this site (CORS). Please pass this to the backend team.',
          { isLikelyCors: true },
        ),
      )
    }

    request.ontimeout = () => reject(new StorageUploadError('The upload timed out. Please try again.'))
    request.onabort = () => reject(new StorageUploadError('Upload cancelled.'))

    if (signal) {
      if (signal.aborted) {
        request.abort()
        return
      }
      signal.addEventListener('abort', () => request.abort(), { once: true })
    }

    request.send(file)
  })
}

/* ------------------------------------------------------------------ step 3 */

/** `POST /v1/product_videos/` — attaches the uploaded file to a variant's gallery. */
export async function attachVideoToVariant(payload: {
  variant_id: number
  file_id: string
  /** Optional — the backend appends after the last existing item when omitted. */
  display_order?: number
}): Promise<ProductVideoDto | null> {
  const body: Record<string, unknown> = {
    variant_id: payload.variant_id,
    file_id: payload.file_id,
  }
  // Omitted rather than nulled: the contract says an absent key means "append".
  if (payload.display_order !== undefined) body.display_order = payload.display_order

  const response = await api.post<Envelope<ProductVideoDto>>(ATTACH_PATH, body, adminAuthConfig())
  const data = response.data?.data
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  return data
}

/* ------------------------------------------------------------------ orchestration */

/**
 * The whole three-step flow, so a caller does not have to sequence it by hand.
 *
 * Validation runs first and throws before any network call, so an oversized or wrong-type
 * file never costs an upload. Progress is reported for step 2 only, which is where all
 * the time goes.
 */
export async function uploadProductVideo(
  {
    variantId,
    file,
    displayOrder,
  }: { variantId: number; file: File; displayOrder?: number },
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<ProductVideoDto | null> {
  const invalid = validateVideoFile(file)
  if (invalid) throw new StorageUploadError(invalid)

  const ticket = await requestVideoUploadUrl(file)
  await uploadVideoToStorage(ticket, file, onProgress, signal)

  return attachVideoToVariant({
    variant_id: variantId,
    file_id: ticket.file_id,
    display_order: displayOrder,
  })
}
