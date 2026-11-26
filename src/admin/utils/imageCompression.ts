/**
 * Re-encodes a picked image in the browser, before it is uploaded.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ──────────────────────────────────────────────────────────────────────────────
 * The uploader used to send whatever the admin picked, byte for byte, with a deliberate
 * note that no size limit was "invented" because the backend contract specifies none.
 * That reasoning was right about VALIDATION and wrong about DELIVERY: the catalogue it
 * produced is 16 PNGs averaging 1.9 MB each — about 31 MB of imagery for a shop with
 * sixteen products. A homepage showing twelve cards asks a phone to download roughly
 * 24 MB of PNG before it looks finished, and the storage host sends no `Cache-Control`,
 * so a second visit pays much of it again.
 *
 * None of that is the shopper's doing, and none of it is visible to the admin, who picks
 * a file out of a design tool and sees the upload succeed. The only place it can be fixed
 * without someone having to remember every time is here, between the file picker and the
 * request.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT IT DOES
 * ──────────────────────────────────────────────────────────────────────────────
 * Decode → downscale to fit `MAX_EDGE` → re-encode as WebP at `QUALITY`. A 2 MB,
 * 2000px-plus PNG export becomes roughly 120-200 kB: a tenth of the bytes, for imagery
 * nobody can tell apart in a product card or a 4:5 gallery frame.
 *
 * WebP because the alternative, PNG, is the format causing the problem — it is lossless,
 * and photographic garment shots are exactly the content it stores worst. Support is
 * effectively universal, and the storage host serves back whatever bytes it was given
 * with no content negotiation, so the format has to be decided here.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT IT DELIBERATELY DOES NOT DO
 * ──────────────────────────────────────────────────────────────────────────────
 * It never fails a selection. Every step — decode, canvas, encode — falls back to the
 * ORIGINAL file if anything goes wrong, or if the result is not actually smaller. An
 * admin updating the catalogue must not be blocked by an optimisation: the worst case
 * here is exactly the behaviour that existed before this file.
 *
 * It also leaves GIFs alone, because re-encoding one through a canvas keeps the first
 * frame and silently discards the animation.
 */

/**
 * Longest edge kept, in CSS pixels doubled for high-density screens.
 *
 * The largest frame this imagery is ever painted in is the product page's 4:5 gallery, a
 * little over 600px wide on a desktop. 1600 covers that at better than 2x, and covers a
 * fullscreen lightbox on a phone outright.
 */
const MAX_EDGE = 1600

/**
 * Per-call overrides.
 *
 * The default suits product photography, which is never painted wider than the product
 * page's gallery. The homepage hero is the exception: it is full-bleed 16:9 artwork that
 * covers a 1920px desktop edge to edge, so it passes a larger `maxEdge`. Downscaling that
 * to 1600 would be visible.
 */
export type CompressOptions = {
  /** Longest edge to keep. Defaults to `MAX_EDGE`. */
  maxEdge?: number
}

/** Visually indistinguishable from the source on photographic content at this scale. */
const QUALITY = 0.82

/** At or below this, the file is already small enough that re-encoding is just churn. */
const SKIP_BELOW_BYTES = 180 * 1024

export type CompressionResult = {
  file: File
  /** Bytes before and after, so the caller can report what was saved. */
  originalBytes: number
  compressedBytes: number
  /** False when the original was handed back unchanged, for any reason. */
  changed: boolean
}

/** Swaps the extension for `.webp`, so the stored object's name matches its contents. */
function toWebpName(name: string): string {
  return name.replace(/\.[^.]+$/, '') + '.webp'
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), 'image/webp', QUALITY)
  })
}

/**
 * Decodes with `createImageBitmap` where it exists — it decodes off the main thread, so
 * picking ten files does not freeze the admin panel — and falls back to an `<img>` and an
 * object URL on browsers that lack it.
 */
async function decode(
  file: File,
): Promise<{ source: CanvasImageSource; width: number; height: number } | null> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file)
      return { source: bitmap, width: bitmap.width, height: bitmap.height }
    } catch {
      // Fall through to the <img> path rather than giving up on the file.
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('decode failed'))
      element.src = url
    })
    return { source: image, width: image.naturalWidth, height: image.naturalHeight }
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * The compressed file, or the original when compression would not help or did not work.
 *
 * Never rejects.
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<CompressionResult> {
  const maxEdge = options.maxEdge ?? MAX_EDGE

  const unchanged: CompressionResult = {
    file,
    originalBytes: file.size,
    compressedBytes: file.size,
    changed: false,
  }

  // An animated GIF would lose every frame but the first.
  if (file.type === 'image/gif') return unchanged
  if (file.size <= SKIP_BELOW_BYTES) return unchanged
  if (typeof document === 'undefined') return unchanged

  try {
    const decoded = await decode(file)
    if (!decoded || !decoded.width || !decoded.height) return unchanged

    const { source, width, height } = decoded
    const scale = Math.min(1, maxEdge / Math.max(width, height))

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)

    const context = canvas.getContext('2d')
    if (!context) return unchanged

    // Garment photography is being downscaled, which is where a cheap sampler shows.
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(source, 0, 0, canvas.width, canvas.height)

    if (typeof (source as ImageBitmap).close === 'function') (source as ImageBitmap).close()

    const blob = await canvasToBlob(canvas)

    /*
     * A browser that cannot encode WebP quietly returns a PNG from `toBlob` instead of
     * failing — and for this content that PNG is usually LARGER than the file we started
     * with. The size comparison rejects that on its own, so no separate format probe is
     * needed.
     */
    if (!blob || blob.size >= file.size) return unchanged

    return {
      file: new File([blob], toWebpName(file.name), { type: 'image/webp', lastModified: Date.now() }),
      originalBytes: file.size,
      compressedBytes: blob.size,
      changed: true,
    }
  } catch {
    return unchanged
  }
}

/** Compresses a batch, in order. Totals let the caller report one combined saving. */
export async function compressImages(
  files: File[],
  options: CompressOptions = {},
): Promise<{
  results: CompressionResult[]
  originalBytes: number
  compressedBytes: number
}> {
  const results: CompressionResult[] = []
  for (const file of files) {
    // Sequential on purpose: ten simultaneous full-resolution decodes is how a browser tab
    // runs out of memory on a modest admin laptop.
    results.push(await compressImage(file, options))
  }

  return {
    results,
    originalBytes: results.reduce((sum, r) => sum + r.originalBytes, 0),
    compressedBytes: results.reduce((sum, r) => sum + r.compressedBytes, 0),
  }
}
