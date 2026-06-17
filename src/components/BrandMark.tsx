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
      aria-label="PanchVastra home"
      className={`group relative inline-flex h-10 min-w-[7.5rem] items-center ${className}`}
    >
      <span className="inline-flex flex-col gap-0 font-display tracking-[0.18em]">
        <span className="whitespace-nowrap text-xl font-bold text-[#d6b36d] md:text-[1.35rem]">
          PANCHVASTRA
        </span>

        <span
          className="h-px max-w-[2.75rem] origin-left rounded-full bg-gradient-to-r from-[#d6b36d] via-[#8a7355] to-transparent opacity-90 transition-[max-width] group-hover:max-w-[4.75rem]"
          aria-hidden
        />
      </span>
    </Link>
  )
}