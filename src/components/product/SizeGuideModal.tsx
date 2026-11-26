import { useEffect } from 'react'
import { OVERLAY_Z, Portal } from '@/components/ui/Portal'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { sizeChartUnitLabel } from '@/api/sizeCharts'
import type { ProductSizeChartDto } from '@/types/api/ProductDetailDto'

/**
 * Size guide — the real table the admin maintains, embedded in the product response.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SEPARATE COMPONENT FROM `SizeChart.tsx`
 * ──────────────────────────────────────────────────────────────────────────────
 * The existing `SizeChart` renders one of three PNG files chosen by a hardcoded
 * category→artwork map in `src/lib/sizeChart.ts`. It could only ever cover the categories
 * someone had committed artwork for, and adding a category meant a code change and a
 * deploy.
 *
 * This renders structured data instead: `headers`, `rows`, a unit and free-text notes,
 * resolved per category by the backend. A real table also beats an image on every count
 * that matters here — it is readable at 375px, it can be selected and copied, a screen
 * reader can navigate it by row and column, and it needs no alt text that duplicates it.
 *
 * The old component is left in place and still used where the hardcoded charts are the
 * only source; this one takes over wherever `size_chart` is present on the product.
 */

type SizeGuideModalProps = {
  isOpen: boolean
  onClose: () => void
  /** The resolved chart. The caller does not render this modal at all when it is null. */
  chart: ProductSizeChartDto
}

export function SizeGuideModal({ isOpen, onClose, chart }: SizeGuideModalProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  // Freezes the page behind the dialog. Shared and reference-counted, because these
  // dialogs stack (the address picker opens the address form over itself) and a
  // per-component save-and-restore unlocks the page while one is still open.
  useBodyScrollLock(isOpen)

  if (!isOpen) return null

  const headers = chart.headers ?? []
  const rows = chart.rows ?? []
  const notes = chart.notes?.trim()

  /* Portalled to `document.body` — see `Portal` for why a `z-index` alone cannot keep
     an overlay above the page it covers. */
  return (
    <Portal>
      <div
        className={`fixed inset-0 ${OVERLAY_Z.modal} flex items-end justify-center bg-espresso/40 px-0 py-0 sm:items-center sm:px-4 sm:py-6`}
        onClick={onClose}
      >
        {/*
          A bottom sheet on a phone and a centred dialog from `sm` up. At 375px a centred
          box with side margins wastes the width a wide measurement table needs most.
        */}
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="size-guide-title"
          onClick={(event) => event.stopPropagation()}
          className="flex max-h-[88vh] w-full max-w-xl flex-col rounded-t-2xl border border-zinc-200 bg-white p-5 shadow-[0_30px_60px_-36px_rgba(43,23,17,0.4)] sm:max-h-[90vh] sm:rounded-2xl sm:p-6"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="type-eyebrow">Fit Guide</p>
              <h2 id="size-guide-title" className="mt-1.5 font-display text-xl font-bold uppercase tracking-tight text-black">
                Size Guide
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close size guide"
              className="flex size-9 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition-colors hover:border-black hover:text-black"
            >
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" strokeWidth={1.8} strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* `min-h-0` lets this flex child shrink so the TABLE scrolls rather than the
              dialog growing past its max height. */}
          <div className="mt-5 min-h-0 flex-1 overflow-auto">
            {headers.length > 0 && rows.length > 0 ? (
              <table className="w-full border-collapse font-sans text-sm">
                <caption className="sr-only">
                  {`Size measurements, ${sizeChartUnitLabel(chart.unit).toLowerCase()}`}
                </caption>
                <thead>
                  <tr>
                    {headers.map((header, index) => (
                      <th
                        key={`${header}-${index}`}
                        scope="col"
                        className="sticky top-0 border-b border-zinc-300 bg-white px-3 py-2.5 text-left text-xs font-bold uppercase tracking-wide text-black"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className={rowIndex % 2 === 1 ? 'bg-zinc-50' : undefined}>
                      {row.map((cell, cellIndex) =>
                        // The first column is the size name, which labels its whole row.
                        cellIndex === 0 ? (
                          <th
                            key={cellIndex}
                            scope="row"
                            className="border-b border-zinc-200 px-3 py-2.5 text-left font-semibold text-black"
                          >
                            {cell}
                          </th>
                        ) : (
                          <td key={cellIndex} className="border-b border-zinc-200 px-3 py-2.5 text-zinc-700">
                            {cell}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="type-body">Measurements for this category have not been published yet.</p>
            )}
          </div>

          <div className="mt-4 shrink-0 space-y-1.5 border-t border-zinc-200 pt-4">
            <p className="font-sans text-xs font-semibold uppercase tracking-wide text-zinc-600">
              {sizeChartUnitLabel(chart.unit)}
            </p>
            {notes ? <p className="type-body-sm">{notes}</p> : null}
          </div>
        </div>
      </div>
    </Portal>
  )
}
