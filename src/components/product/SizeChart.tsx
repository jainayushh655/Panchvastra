import { useEffect } from 'react'

/**
 * Generic apparel measurements — no per-product size-chart data exists in the API yet.
 * Rows are filtered to the sizes this product actually offers, so at least the
 * available-sizes list itself is real; only the measurement numbers are illustrative
 * until the backend exposes per-product measurements (structure is ready for that swap).
 */
const GENERIC_SIZE_CHART = [
  { size: 'S', chest: '36', length: '27', shoulder: '17' },
  { size: 'M', chest: '38', length: '28', shoulder: '18' },
  { size: 'L', chest: '40', length: '29', shoulder: '19' },
  { size: 'XL', chest: '42', length: '30', shoulder: '20' },
  { size: 'XXL', chest: '44', length: '31', shoulder: '21' },
  { size: 'XXXL', chest: '46', length: '32', shoulder: '22' },
]

type SizeChartProps = {
  isOpen: boolean
  onClose: () => void
  sizes: string[]
}

export function SizeChart({ isOpen, onClose, sizes }: SizeChartProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const rows = sizes.length ? GENERIC_SIZE_CHART.filter((r) => sizes.includes(r.size)) : GENERIC_SIZE_CHART

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Size chart"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg border border-zinc-200 bg-white p-6 shadow-[0_30px_60px_-36px_rgba(0,0,0,0.3)]"
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

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[380px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-300">
                <th className="py-2.5 pr-3 font-semibold uppercase tracking-wide text-black">Size</th>
                <th className="py-2.5 pr-3 font-semibold uppercase tracking-wide text-black">Chest (in)</th>
                <th className="py-2.5 pr-3 font-semibold uppercase tracking-wide text-black">Length (in)</th>
                <th className="py-2.5 font-semibold uppercase tracking-wide text-black">Shoulder (in)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.size} className="border-b border-zinc-100">
                  <td className="py-2.5 pr-3 font-semibold text-black">{row.size}</td>
                  <td className="py-2.5 pr-3 text-zinc-600">{row.chest}</td>
                  <td className="py-2.5 pr-3 text-zinc-600">{row.length}</td>
                  <td className="py-2.5 text-zinc-600">{row.shoulder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-xs text-zinc-500">
          Measurements are approximate and may vary by ±0.5 inch. All values in inches.
        </p>
      </div>
    </div>
  )
}
