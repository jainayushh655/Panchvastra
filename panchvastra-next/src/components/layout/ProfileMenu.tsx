'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthProvider'
import { useCart } from '@/context/CartProvider'
import { LogoutConfirmation } from '@/components/layout/LogoutConfirmation'

/**
 * The account menu in the navbar.
 *
 * Ported from the Vite component. The markup, the classes, the ARIA attributes, the
 * outside-click and Escape handling and the logout sequence (clear cart -> clear session
 * -> close -> go home, replacing history) are all unchanged.
 *
 * TWO ROUTER SUBSTITUTIONS.
 *
 *  - `useNavigate()` -> `useRouter()`; `navigate('/', { replace: true })` ->
 *    `router.replace('/')`.
 *
 *  - `useLocation()` -> `usePathname()`. The Vite version closes the menu when either the
 *    pathname OR the query string changes. Reading the query here would mean
 *    `useSearchParams()`, which opts the whole navbar out of static rendering unless it
 *    sits behind its own Suspense boundary (see `ShopNavLink`), and the navbar must be in
 *    the server HTML. Pathname alone is behaviourally equivalent for this menu: every
 *    item in it is a pathname link, so no interaction with the menu produces a
 *    query-only navigation, and a query-only change elsewhere on the page happens while
 *    the menu is closed.
 *
 * SIGNED-OUT FIRST. `user` is null on the server and on the first client render, so this
 * renders "Sign In" in both and swaps to the signed-in items once the session is
 * restored. That is the hydration contract described in `AuthProvider`.
 */
export function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const { clear } = useCart()

  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const handleLogout = () => {
    clear()
    logout()
    setConfirmingLogout(false)
    setOpen(false)
    router.replace('/')
  }

  const menuItems: { label: string; href?: string; onClick?: () => void }[] = user
    ? [
        { label: 'My Profile', href: '/profile' },
        { label: 'My Orders', href: '/orders' },
        { label: 'Logout', onClick: () => setConfirmingLogout(true) },
      ]
    : [{ label: 'Sign In', href: '/login' }]

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="rounded-md border border-zinc-700 p-2 text-cream transition-colors hover:border-sand sm:p-2.5"
        aria-label={user ? 'Open profile menu' : 'Open account menu'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg className="size-4 sm:size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.75}
            d="M12 12a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0"
          />
        </svg>
      </button>

      {open ? (
        <div
          id="profile-menu"
          role="menu"
          className="absolute right-0 top-full mt-2 w-44 rounded-lg border border-soft-beige bg-cream p-2 shadow-[0_16px_40px_-24px_rgba(43,23,17,0.45)]"
        >
          {menuItems.map((item) =>
            item.href ? (
              <Link
                key={item.label}
                href={item.href}
                role="menuitem"
                className="flex items-center rounded-md px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-soft-beige hover:text-espresso"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="flex w-full items-center rounded-md px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-soft-beige hover:text-espresso"
                onClick={() => {
                  item.onClick?.()
                  setOpen(false)
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}

      <LogoutConfirmation
        isOpen={confirmingLogout}
        onConfirm={handleLogout}
        onCancel={() => setConfirmingLogout(false)}
      />
    </div>
  )
}
