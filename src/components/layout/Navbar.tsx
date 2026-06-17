import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { BrandMark } from '@/components/BrandMark'
import { useCart } from '@/context/CartProvider'
import { useCatalog } from '@/hooks/useCatalog'

export function Navbar() {
  const { totalItems } = useCart()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { categories } = useCatalog()

  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [mobileCategoriesOpen, setMobileCategoriesOpen] = useState(false)
  const categoryRef = useRef<HTMLDivElement>(null)

  const activeCategorySlug = searchParams.get('category')
  const categoryFilterActive = Boolean(
    activeCategorySlug && categories.some((c) => c.slug === activeCategorySlug),
  )

  useEffect(() => {
    if (!categoryOpen) return
    const close = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setCategoryOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [categoryOpen])

  useEffect(() => {
    if (!categoryOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCategoryOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [categoryOpen])

  const submitSearch = () => {
    const query = q.trim()
    navigate(query ? `/shop?q=${encodeURIComponent(query)}` : '/shop')
    setOpen(false)
  }

  const chevron = (
    <svg
      className={`size-4 shrink-0 transition-transform ${categoryOpen ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )

  return (
    <header className="sticky top-0 z-50 border-b border-[#e6d7bb] bg-[rgba(255,248,236,0.92)] backdrop-blur-xl shadow-[0_1px_0_rgba(255,255,255,0.7)]">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 md:py-3.5">
        <button
          type="button"
          className="rounded-full border border-[#e3d6be] bg-white/70 p-2 text-zinc-700 shadow-sm md:hidden"
          aria-label="Open menu"
          onClick={() => setOpen((x) => !x)}
        >
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <BrandMark className="shrink-0" />

        <div className="hidden flex-1 justify-center sm:flex">
          <div className="flex w-full max-w-[280px] items-center rounded-full border border-[#dcc8a8] bg-white/90 px-3 py-1.5 shadow-sm">
            <svg className="size-4 shrink-0 text-[#8a7355]" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.3-4.3m1.8-5.2a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z" />
            </svg>
            <input
              placeholder="Search"
              value={q}
              aria-label="Search products"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              className="w-full bg-transparent px-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400"
            />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <nav className="ml-4 hidden gap-8 font-sans text-sm font-medium tracking-wide text-zinc-700 md:flex">
            <NavLink
              to="/shop"
              className={({ isActive }) =>
                `transition-colors hover:text-[#8a7355] ${
                  isActive && !categoryFilterActive ? 'text-[#8a7355]' : ''
                }`
              }
              end
            >
              Shop
            </NavLink>

            <NavLink
              to="/about"
              className={({ isActive }) =>
                `transition-colors hover:text-[#8a7355] ${
                  isActive ? 'text-[#8a7355]' : ''
                }`
              }
            >
              About Us
            </NavLink>
          </nav>
          <Link
            to="/cart"
            className="relative rounded-full border border-[#e3d6be] bg-white/80 p-2 text-zinc-700 shadow-sm hover:bg-white"
            aria-label="Cart"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
            </svg>
            {totalItems > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#d6b36d] px-1 text-[10px] font-bold text-zinc-950">
                {totalItems}
              </span>
            ) : null}
          </Link>
          
        </div>
      </div>

      {/* Mobile drawers */}
      {open ? (
        <div className="border-t border-[#e6d7bb] px-4 py-4 md:hidden">
          <input
            placeholder="Search"
            value={q}
            aria-label="Search products"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
            className="mb-3 w-full rounded-full border border-[#dcc8a8] bg-white px-4 py-2 text-sm outline-none"
          />
          <nav className="flex flex-col gap-1">
            <Link
              to="/shop"
              className="rounded-lg px-3 py-2 text-zinc-800 hover:bg-[#f4ead7]"
              onClick={() => setOpen(false)}
            >
              Shop
            </Link>
            <Link
              to="/about"
              className="rounded-lg px-3 py-2 text-zinc-800 hover:bg-[#f4ead7]"
              onClick={() => setOpen(false)}
            >
              About Us
            </Link>
            <Link
              to="/contact"
              className="rounded-lg px-3 py-2 font-semibold text-zinc-800 hover:bg-[#f4ead7]"
              onClick={() => setOpen(false)}
            >
              Contact
            </Link>
          </nav>
        </div>
      ) : null}
    </header>
  )
}
