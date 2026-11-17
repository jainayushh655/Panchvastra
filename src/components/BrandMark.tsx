import { Link } from 'react-router-dom'

export function BrandMark({
  className = '',
  to = '/',
}: {
  className?: string
  to?: string
}) {
  return (
    <Link
      to={to}
      aria-label="PANCHVASTRA home"
      className={`inline-flex h-10 items-center justify-center ${className}`}
    >
      {/*
        The base size is fluid instead of a fixed 12px. `3.45vw` only falls below the 0.75rem
        ceiling under a 348px viewport — narrower than any phone in use, 360px Android included
        — so at 360px and every width above it this clamps to exactly 0.75rem and renders
        identically to before. Below
        that (only reachable via high browser zoom) the wordmark scales down to a 0.5625rem
        floor instead of pushing into the wishlist/cart/account controls. At the zoom levels
        that produce such a viewport the glyphs are magnified several times over, so the
        smaller CSS size stays perfectly readable.
      */}
      <span className="whitespace-nowrap font-display text-[clamp(0.5625rem,3.45vw,0.75rem)] font-bold uppercase tracking-[0.04em] text-white sm:text-lg sm:tracking-[0.18em] md:text-xl md:tracking-[0.22em]">
        PANCHVASTRA
      </span>
    </Link>
  )
}
