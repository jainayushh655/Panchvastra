import { Link } from 'react-router-dom'

/** Modular wordmark — swap for SVG lockup when brand assets land */
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
      className={`group inline-flex flex-col gap-0 font-display tracking-[0.12em] ${className}`}
    >
      <span className="text-xl font-bold text-zinc-900 transition-colors md:text-[1.35rem] dark:text-white">
        PANCH<span className="text-orange-500 dark:text-orange-400">V</span>ASTRA
      </span>
      <span
        className="h-px max-w-[2.85rem] origin-left rounded-full bg-gradient-to-r from-orange-500 via-orange-300 to-transparent opacity-90 transition-[max-width] group-hover:max-w-[4.75rem] dark:from-orange-400"
        aria-hidden
      />
    </Link>
  )
}
