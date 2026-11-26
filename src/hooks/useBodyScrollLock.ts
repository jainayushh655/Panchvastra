import { useEffect } from 'react'

/**
 * Freezes the page behind an open overlay, and — this is the part that was missing —
 * survives overlays being open at the same time.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY A COUNTER RATHER THAN SAVE-AND-RESTORE
 * ──────────────────────────────────────────────────────────────────────────────
 * Each overlay used to do its own `body.style.overflow = 'hidden'` and put the previous
 * value back on unmount. That is correct for ONE overlay and wrong for two, which this
 * app genuinely has: the address picker opens the address form over itself, and the
 * product page can show the size guide above an already-locked screen. The second
 * overlay saves `'hidden'` (the first one's value), and the FIRST one to close restores
 * `''` — unlocking the page while a dialog is still open, so the page scrolls underneath
 * it. Closing them in the other order leaves `overflow: hidden` stuck on the body with
 * no overlay left to explain it, and the whole site stops scrolling.
 *
 * A module-level depth counter fixes both directions: the lock is applied when the count
 * goes 0 → 1 and released only when it returns to 0, whatever order the overlays unmount
 * in. The original inline value is captured once, at the first lock, and restored once,
 * at the last release.
 *
 * `paddingRight` compensates for the scrollbar that `overflow: hidden` removes. Without
 * it, opening any dialog shifts the entire page several pixels to the right on a desktop
 * browser with classic scrollbars — a visible jolt on every open and close.
 *
 * @param active Whether this caller currently wants the page locked. Passing the open
 *               flag (rather than mounting conditionally) keeps the hook order stable.
 */

let lockDepth = 0
let previousOverflow = ''
let previousPaddingRight = ''

export function useBodyScrollLock(active: boolean): void {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return

    const { body } = document

    if (lockDepth === 0) {
      previousOverflow = body.style.overflow
      previousPaddingRight = body.style.paddingRight

      // `innerWidth` includes the scrollbar, `clientWidth` does not. The difference is
      // exactly the width that is about to disappear. It is 0 on phones and on any
      // browser using overlay scrollbars, where this correctly does nothing.
      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`

      body.style.overflow = 'hidden'
    }

    lockDepth += 1

    return () => {
      lockDepth -= 1
      if (lockDepth > 0) return

      body.style.overflow = previousOverflow
      body.style.paddingRight = previousPaddingRight
    }
  }, [active])
}
