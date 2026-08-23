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
      <span className="whitespace-nowrap font-display text-xs font-bold uppercase tracking-[0.04em] text-white sm:text-lg sm:tracking-[0.18em] md:text-xl md:tracking-[0.22em]">
        PANCHVASTRA
      </span>
    </Link>
  )
}
