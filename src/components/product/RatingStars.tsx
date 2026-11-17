/**
 * Five stars with half-star support.
 *
 * A 4.8 average has to read as "nearly five", and rounding it to 5 would overstate every
 * product on the site. Halves are drawn with an SVG `linearGradient` clip rather than two
 * overlaid elements, so a star is one path and scales cleanly at any size.
 *
 * Each instance needs its own gradient id — ids are document-global, so a second component
 * reusing the same id would silently inherit the first one's fill. `useId` guarantees
 * uniqueness without a module-level counter that would break under Strict Mode's double
 * render.
 */

import { useId } from 'react'

const STAR_PATH =
  'M12 2.6l2.74 5.55 6.13.89-4.44 4.32 1.05 6.1L12 16.59l-5.48 2.88 1.05-6.1-4.44-4.32 6.13-.89L12 2.6z'

type RatingStarsSize = 'sm' | 'md' | 'lg'

const SIZE_CLASS: Record<RatingStarsSize, string> = {
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-5',
}

type RatingStarsProps = {
  /** 0–5. Values in between are rendered to the nearest half. */
  rating: number
  size?: RatingStarsSize
  className?: string
  /**
   * Accessible label. Defaults to "4.8 out of 5 stars". Pass `null` when the stars sit
   * next to text that already says the same thing, so a screen reader is not told twice.
   */
  label?: string | null
}

export function RatingStars({ rating, size = 'md', className = '', label }: RatingStarsProps) {
  const gradientId = useId()
  const safeRating = Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0
  // Snap to halves: 4.8 shows as four and a half, not as a 96%-filled fifth star.
  const rounded = Math.round(safeRating * 2) / 2

  const accessibleLabel = label === null ? undefined : (label ?? `${safeRating.toFixed(1)} out of 5 stars`)

  return (
    <span
      className={`inline-flex items-center gap-0.5 text-chocolate ${className}`}
      role={accessibleLabel ? 'img' : undefined}
      aria-label={accessibleLabel}
      aria-hidden={accessibleLabel ? undefined : true}
    >
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id={gradientId}>
            <stop offset="50%" stopColor="currentColor" />
            <stop offset="50%" stopColor="transparent" />
          </linearGradient>
        </defs>
      </svg>

      {[1, 2, 3, 4, 5].map((position) => {
        const filled = rounded >= position
        const half = !filled && rounded >= position - 0.5

        return (
          <svg
            key={position}
            className={SIZE_CLASS[size]}
            viewBox="0 0 24 24"
            fill={filled ? 'currentColor' : half ? `url(#${gradientId})` : 'none'}
            stroke="currentColor"
            strokeWidth={filled ? 0 : 1.5}
            aria-hidden
          >
            <path d={STAR_PATH} strokeLinejoin="round" />
          </svg>
        )
      })}
    </span>
  )
}
