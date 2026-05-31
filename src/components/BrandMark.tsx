import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const LOGO_SRC = '/images/logo.png'
const SCROLL_THRESHOLD = 72

export function BrandMark({
  className = '',
  to = '/',
}: {
  className?: string
  to?: string
}) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD)

    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <Link
      to={to}
      aria-label="PanchVastra home"
      className={`group relative inline-flex h-10 min-w-[7.5rem] items-center ${className}`}
    >
      {/* Brand Text */}
      <span
        className={`inline-flex flex-col gap-0 font-display tracking-[0.12em] transition-all duration-300 ease-out ${
          scrolled
            ? 'pointer-events-none scale-95 opacity-0'
            : 'scale-100 opacity-100'
        }`}
        aria-hidden={scrolled}
      >
        <span className="whitespace-nowrap text-xl font-bold text-zinc-900 md:text-[1.35rem]">
          PANCH<span className="text-orange-500">V</span>ASTRA
        </span>

        <span
          className="h-px max-w-[2.85rem] origin-left rounded-full bg-gradient-to-r from-orange-500 via-orange-300 to-transparent opacity-90 transition-[max-width] group-hover:max-w-[4.75rem]"
          aria-hidden
        />
      </span>

      {/* Logo shown after scrolling */}
      <img
        src={LOGO_SRC}
        alt="PanchVastra"
        className={`absolute left-0 top-1/2 -translate-y-1/2 h-10 md:h-12 lg:h-10 w-auto object-contain object-left transition-all duration-300 ease-out ${
          scrolled
            ? 'scale-100 opacity-100'
            : 'pointer-events-none scale-95 opacity-0'
        }`}
      />
    </Link>
  )
}