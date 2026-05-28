import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate, useSearchParams } from 'react-router-dom'
import { BrandMark } from '@/components/BrandMark'
import { useCart } from '@/context/CartProvider'
import { useTheme } from '@/context/ThemeProvider'
import { useCatalog } from '@/hooks/useCatalog'

export function Navbar() {
  const { totalItems } = useCart()
  const { toggleTheme } = useTheme()
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
    <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
        <button
          type="button"
          className="rounded-lg p-2 text-zinc-700 md:hidden dark:text-zinc-200"
          aria-label="Open menu"
          onClick={() => setOpen((x) => !x)}
        >
          <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <BrandMark className="shrink-0" />

        <div className="hidden max-w-[200px] sm:flex">
            <input
              placeholder="Search"
              value={q}
              aria-label="Search products"
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
              className="w-full rounded-full border border-zinc-200 bg-zinc-50 px-4 py-1.5 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-orange-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <nav className="ml-8 hidden gap-8 font-sans text-sm font-medium tracking-wide text-zinc-600 md:flex dark:text-zinc-400">
          <NavLink
            to="/shop"
            className={({ isActive }) =>
              `transition-colors hover:text-orange-600 dark:hover:text-orange-400 ${
                isActive && !categoryFilterActive ? 'text-orange-600 dark:text-orange-400' : ''
              }`
            }
            end
          >
            Shop
          </NavLink>


          <NavLink
            to="/about"
            className={({ isActive }) =>
              `transition-colors hover:text-orange-600 dark:hover:text-orange-400 ${
                isActive ? 'text-orange-600 dark:text-orange-400' : ''
              }`
            }
          >
            About Us
          </NavLink>
        </nav>
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={toggleTheme}
            className="rounded-full p-2 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <span className="hidden dark:inline">☀</span>
            <span className="dark:hidden">🌙</span>
          </button>
          <Link
            to="/cart"
            className="relative rounded-full p-2 text-zinc-700 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
            aria-label="Cart"
          >
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
            </svg>
            {totalItems > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-zinc-950">
                {totalItems}
              </span>
            ) : null}
          </Link>
          
        </div>
      </div>

      {/* Mobile drawers */}
      {open ? (
        <div className="border-t border-zinc-200 px-4 py-4 md:hidden dark:border-zinc-800">
          <input
            placeholder="Search"
            value={q}
            aria-label="Search products"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitSearch()}
            className="mb-3 w-full rounded-full border border-zinc-200 bg-zinc-50 px-4 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
          />
          <nav className="flex flex-col gap-1">
            <Link
              to="/shop"
              className="rounded-lg px-3 py-2 text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => setOpen(false)}
            >
              Shop
            </Link>
            <Link
              to="/about"
              className="rounded-lg px-3 py-2 text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={() => setOpen(false)}
            >
              About Us
            </Link>
            <Link
              to="/contact"
              className="rounded-lg px-3 py-2 font-semibold text-zinc-800 hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
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
