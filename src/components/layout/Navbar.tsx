import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useSearchParams } from 'react-router-dom'
import { BrandMark } from '@/components/BrandMark'
import { ProfileMenu } from '@/components/layout/ProfileMenu'
import { useCart } from '@/context/CartProvider'
import { useWishlist } from '@/context/WishlistProvider'
import { getCategories } from '@/api/category'
import type { CategoryDto } from '@/types/api/CategoryDto'

export function Navbar() {
  const { totalItems } = useCart()
  const { count: wishlistCount } = useWishlist()
  const [searchParams] = useSearchParams()
  const [categories, setCategories] = useState<CategoryDto[]>([])

  const [open, setOpen] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const categoryRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void getCategories().then((data) => setCategories(data))
  }, [])

  const activeCategorySlug = searchParams.get('category')
  const categoryFilterActive = Boolean(
    activeCategorySlug && categories.some((c) => c.name.toLowerCase() === activeCategorySlug),
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

  const navLinkCls = ({ isActive }: { isActive: boolean }) =>
    `text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:text-white ${
      isActive ? 'text-white' : 'text-zinc-400'
    }`

  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-black text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-3.5 sm:gap-3 sm:px-4">
        {/* LEFT */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            className="rounded-md border border-zinc-700 p-1.5 text-white sm:p-2 md:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen((x) => !x)}
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <nav className="hidden items-center gap-7 md:flex" aria-label="Primary">
            <NavLink
              to="/shop"
              className={({ isActive }) => navLinkCls({ isActive: isActive && !categoryFilterActive })}
              end
            >
              Shop
            </NavLink>
            <NavLink to="/about" className={navLinkCls}>
              About Us
            </NavLink>
          </nav>
        </div>

        {/* CENTER */}
        <div className="flex justify-self-center">
          <BrandMark />
        </div>

        {/* RIGHT */}
        <div className="flex items-center justify-self-end gap-0.5 sm:gap-2.5">
          <Link
            to="/wishlist"
            className="relative rounded-md border border-zinc-700 p-2 text-white transition-colors hover:border-zinc-500 sm:p-2.5"
            aria-label="Wishlist"
          >
            <svg className="size-4 sm:size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.75"
                d="M12 20.25s-7.5-4.6-9.75-9.1C.75 7.6 2.6 4.5 6 4.5c2 0 3.5 1 6 3.3 2.5-2.3 4-3.3 6-3.3 3.4 0 5.25 3.1 3.75 6.65-2.25 4.5-9.75 9.1-9.75 9.1z"
              />
            </svg>
            {wishlistCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-black sm:h-[18px] sm:min-w-[18px] sm:text-[10px]">
                {wishlistCount}
              </span>
            ) : null}
          </Link>
          <Link
            to="/cart"
            className="relative rounded-md border border-zinc-700 p-2 text-white transition-colors hover:border-zinc-500 sm:p-2.5"
            aria-label="Cart"
          >
            <svg className="size-4 sm:size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
            </svg>
            {totalItems > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-white px-1 text-[9px] font-bold text-black sm:h-[18px] sm:min-w-[18px] sm:text-[10px]">
                {totalItems}
              </span>
            ) : null}
          </Link>
          <ProfileMenu />
        </div>
      </div>

      {/* Mobile drawer */}
      {open ? (
        <div className="border-t border-zinc-800 px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            <Link
              to="/shop"
              className="rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-zinc-200 hover:bg-zinc-900"
              onClick={() => setOpen(false)}
            >
              Shop
            </Link>
            <Link
              to="/about"
              className="rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-zinc-200 hover:bg-zinc-900"
              onClick={() => setOpen(false)}
            >
              About Us
            </Link>
            <Link
              to="/contact"
              className="rounded-md px-3 py-2 text-sm font-semibold uppercase tracking-wide text-zinc-200 hover:bg-zinc-900"
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
