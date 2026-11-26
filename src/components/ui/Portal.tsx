import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * Renders its children into `document.body` instead of where it sits in the tree.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY EVERY OVERLAY IN THIS APP NEEDS THIS
 * ──────────────────────────────────────────────────────────────────────────────
 * `position: fixed` and `z-index` are not absolute. They are resolved inside the nearest
 * ANCESTOR STACKING CONTEXT, and a stacking context is created by far more than an
 * explicit `z-index`: `position: sticky` (always, even with `z-index: auto`), any
 * `transform`, `filter`, `backdrop-filter`, `opacity < 1`, `will-change`, `isolation`,
 * `contain`, and more.
 *
 * The product page is the case that proved it. Its gallery column is
 * `lg:sticky lg:top-24`, so it creates a stacking context whose own z-index is `auto`.
 * The fullscreen image lightbox rendered inside it asked for `z-[100]` — but that 100 was
 * only ever a position WITHIN the sticky column. Against the rest of the page the whole
 * column still ranked as `auto`, so the sticky navbar (`z-50`) and every positioned
 * element in the sibling product-info column — the colour swatches, the size tiles, the
 * offer banner — painted straight over the top of the open lightbox: the backdrop dimmed
 * the page but the controls stayed bright and clickable above it.
 *
 * No z-index value can fix that, because the number is being compared inside the wrong
 * box. The element has to LEAVE the subtree. Portalling to `document.body` puts the
 * overlay in the root stacking context, where `fixed inset-0` means the viewport and the
 * z-index means what it says.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE Z-INDEX SCALE (see `OVERLAY_Z` below)
 * ──────────────────────────────────────────────────────────────────────────────
 * Portalled overlays are siblings in the body, so DOM order alone would decide ties.
 * Explicit, named layers make the ordering intentional rather than incidental.
 *
 * `mounted` guards the first render: `document.body` does not exist during a server
 * render, and reading it in render rather than in an effect would break the moment this
 * app is prerendered. Rendering `null` for one tick costs nothing — an overlay only ever
 * mounts in response to a click.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || typeof document === 'undefined') return null

  return createPortal(children, document.body)
}

/**
 * The app's overlay layers, in paint order. Use these rather than inventing a number.
 *
 * Everything here sits above the sticky navbar (`z-50`) and below the toast stack
 * (`z-[9999]`), which must stay readable even while a dialog is open — a toast reporting
 * "Address saved" is about the dialog's own work.
 */
export const OVERLAY_Z = {
  /** Backdrop + dialog: confirmations, forms, pickers, the size guide. */
  modal: 'z-[1000]',
  /** Fullscreen media: the product gallery and review photo lightboxes. */
  lightbox: 'z-[1010]',
} as const
