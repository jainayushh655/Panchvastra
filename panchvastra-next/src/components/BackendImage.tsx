import Image, { type ImageProps } from 'next/image'

/**
 * An image whose URL comes from the Django backend — a product photo, a category tile, a
 * hero slide.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE PROBLEM THIS SOLVES
 * ──────────────────────────────────────────────────────────────────────────────
 * `next/image` only optimises a remote URL whose host is listed in
 * `images.remotePatterns`. For an unlisted host the page renders and the markup looks
 * correct, but the browser then requests `/_next/image?url=…` and the optimizer answers:
 *
 *     400  "url" parameter is not allowed
 *
 * — so every product photo and category tile would be broken while the build and the HTML
 * both looked healthy. That was measured against this application, not assumed.
 *
 * What the repository establishes about the image host is recorded in `next.config.ts`:
 * the API origin is known (`https://api.panchvastra.com`, from the Vite proxy), and the
 * mappers pass the backend's URLs through untouched, so the host is whatever the backend
 * puts in `primary_image` / `image_url`. No committed response pins that down, and no
 * hostname is invented to cover the gap.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * SO THE DECISION IS MADE PER IMAGE, FROM THE SAME VALUE THE ALLOW-LIST USES
 * ──────────────────────────────────────────────────────────────────────────────
 * `NEXT_PUBLIC_OPTIMIZED_IMAGE_HOST` is set by `next.config.ts` from the configured API
 * origin — the one host it also allows. An image on that host is optimised; anything else
 * renders unoptimised, which is exactly what a plain `<img>` would do and cannot 400.
 *
 * The practical outcomes:
 *   - Images served by the Django host  -> optimised automatically, no further work.
 *   - Images served by a CDN/blob store -> correct, unoptimised. Add that host to
 *     `remotePatterns` (and it will then need to be the configured origin, or this
 *     module's rule widened deliberately) to optimise them.
 *   - No API origin configured at all   -> everything unoptimised. This is the state
 *     local development and CI build in, and it keeps them working offline.
 *
 * Either way the markup, the reserved box and the lazy/priority behaviour are identical,
 * so no layout shift depends on which branch is taken.
 *
 * This component renders on the server and ships no JavaScript of its own.
 */

/** Inlined at build time by `next.config.ts`; `''` when no API origin is configured. */
const OPTIMIZED_HOST = process.env.NEXT_PUBLIC_OPTIMIZED_IMAGE_HOST ?? ''

/**
 * True only for an absolute URL on the one allow-listed host.
 *
 * A relative `src` (`/images/no-image.png`, the mappers' fallback) is local and always
 * optimisable, so it returns true as well. Anything unparseable is treated as not
 * optimisable — the safe direction.
 */
export function isOptimizable(src: ImageProps['src']): boolean {
  if (typeof src !== 'string') return true // a static import is always local
  if (!src.startsWith('http://') && !src.startsWith('https://')) return true
  if (!OPTIMIZED_HOST) return false

  try {
    return new URL(src).hostname === OPTIMIZED_HOST
  } catch {
    return false
  }
}

export function BackendImage(props: ImageProps) {
  // `alt` is required by `ImageProps`, so every call site has already supplied one — it
  // arrives in `props` and is spread below.
  return <Image {...props} unoptimized={!isOptimizable(props.src)} />
}
