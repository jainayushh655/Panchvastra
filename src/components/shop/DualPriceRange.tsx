import { useEffect, useState } from 'react'
import { formatInr } from '@/lib/format'

const STEP = 50

type DualPriceRangeProps = {
  boundMin: number
  boundMax: number
  /** From URL: null means “full range” / unset */
  minUrl: number | null
  maxUrl: number | null
  onCommit: (min: number | null, max: number | null) => void
}

export function DualPriceRange({ boundMin, boundMax, minUrl, maxUrl, onCommit }: DualPriceRangeProps) {
  const span = Math.max(boundMax - boundMin, STEP)
  const [low, setLow] = useState(() => minUrl ?? boundMin)
  const [high, setHigh] = useState(() => maxUrl ?? boundMax)

  useEffect(() => {
    setLow(minUrl ?? boundMin)
    setHigh(maxUrl ?? boundMax)
  }, [minUrl, maxUrl, boundMin, boundMax])

  const commit = () => {
    const atMin = low <= boundMin
    const atMax = high >= boundMax
    if (atMin && atMax) {
      onCommit(null, null)
      return
    }
    onCommit(atMin ? null : low, atMax ? null : high)
  }

  const lowPct = ((low - boundMin) / span) * 100
  const highPct = ((high - boundMin) / span) * 100

  return (
    <div>
      <p className="text-center font-display text-sm font-semibold tabular-nums tracking-tight text-zinc-800 dark:text-zinc-100">
        {formatInr(low)} – {formatInr(high)}
      </p>
      <div className="relative mx-0.5 mt-4 h-8">
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-zinc-200 dark:bg-zinc-700" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-orange-500/80"
          style={{
            left: `${lowPct}%`,
            width: `${Math.max(highPct - lowPct, 0)}%`,
          }}
          aria-hidden
        />
        <input
          type="range"
          min={boundMin}
          max={Math.max(boundMin, Math.min(high - STEP, boundMax))}
          step={STEP}
          value={low}
          onChange={(e) => {
            const v = Number(e.target.value)
            setLow(Math.min(v, high - STEP))
          }}
          onPointerUp={commit}
          onKeyUp={commit}
          className="shop-range shop-range-min absolute inset-x-0 top-1/2 z-[2] w-full -translate-y-1/2 cursor-pointer"
          aria-label="Minimum price"
        />
        <input
          type="range"
          min={Math.max(low + STEP, boundMin)}
          max={boundMax}
          step={STEP}
          value={high}
          onChange={(e) => {
            const v = Number(e.target.value)
            setHigh(Math.max(v, low + STEP))
          }}
          onPointerUp={commit}
          onKeyUp={commit}
          className="shop-range shop-range-max absolute inset-x-0 top-1/2 z-[3] w-full -translate-y-1/2 cursor-pointer"
          aria-label="Maximum price"
        />
      </div>
      <p className="mt-2 text-center text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        Drag to set range · {formatInr(boundMin)} – {formatInr(boundMax)}
      </p>
    </div>
  )
}
