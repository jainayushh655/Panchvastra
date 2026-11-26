import { useEffect } from 'react'
import { OVERLAY_Z, Portal } from '@/components/ui/Portal'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import type { SizeChart as SizeChartData } from '@/lib/sizeChart'

/**
 * Size-chart modal.
 *
 * The measurements are now the real artwork supplied per category rather than the previous
 * hardcoded generic table, so this component no longer owns any sizing data — which chart
 * to show is decided once by `getSizeChart()` and passed in. Modal chrome (backdrop click,
 * Escape to close, header, close button) is unchanged.
 */
type SizeChartProps = {
  isOpen: boolean
  onClose: () => void
  /** The resolved chart. The caller does not render this modal at all when it is null. */
  chart: SizeChartData
}

export function SizeChart({ isOpen, onClose, chart }: SizeChartProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Freezes the page behind the dialog. Shared and reference-counted, because these
  // dialogs stack (the address picker opens the address form over itself) and a
  // per-component save-and-restore unlocks the page while one is still open.
  useBodyScrollLock(isOpen)

  if (!isOpen) return null

  /* Portalled to `document.body` — see `Portal` for why a `z-index` alone cannot keep
     an overlay above the page it covers. */
  return (
    <Portal>
      <div
        className={`fixed inset-0 ${OVERLAY_Z.modal} flex items-center justify-center bg-black/35 px-4 py-6`}
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Size chart"
          onClick={(e) => e.stopPropagation()}
          /*
           * `max-h` + `flex-col` let the header stay put while only the artwork scrolls, so a
           * tall chart is reachable on a short screen without the dialog leaving the viewport.
           */
          className="flex max-h-[90vh] w-full max-w-lg flex-col border border-zinc-200 bg-white p-6 shadow-[0_30px_60px_-36px_rgba(0,0,0,0.3)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Fit Guide</p>
              <h2 className="mt-2 text-xl font-semibold uppercase tracking-tight text-black">Size Chart</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close size chart"
              className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition-colors hover:border-black hover:text-black"
            >
              ✕
            </button>
          </div>

          {/*
            `min-h-0` lets this flex child actually shrink so its own scrollbar appears
            instead of the dialog growing past `max-h`.
          */}
          <div className="mt-5 min-h-0 flex-1 overflow-auto">
            {/*
              `w-full h-auto` scales the artwork to the dialog width and lets the height
              follow, so the ratio is preserved exactly — nothing is cropped or stretched.
            */}
            {/*
              WebP first, PNG as the fallback. The charts are ~300 kB as PNG and ~90 kB as
              WebP for the same artwork, and this modal is opened mid-purchase — exactly
              when a shopper on a phone is least willing to wait.

              `width`/`height` are the artwork's real pixel dimensions. They do not size
              the image (the classes do that); they give the browser the 3:4 ratio up
              front, so the dialog reserves the right box instead of reflowing when the
              chart lands.
            */}
            <picture>
              <source srcSet={chart.webpSrc} type="image/webp" />
              <img
                src={chart.src}
                alt={chart.alt}
                width={1086}
                height={1448}
                className="block h-auto w-full"
                loading="lazy"
                decoding="async"
              />
            </picture>
          </div>

          <p className="mt-4 shrink-0 text-xs text-zinc-500">
            Measurements are approximate and may vary by ±0.5 inch. All values in inches.
          </p>
        </div>
      </div>
    </Portal>
  )
}
