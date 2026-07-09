import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthProvider'
import { useCart } from '@/context/CartProvider'

export function ProfileMenu() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { clear } = useCart()

  useEffect(() => {
    setOpen(false)
  }, [location.pathname, location.search])

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
  setOpen(false)
  navigate('/login', { replace: true })
}

  const menuItems = user
    ? [
        { label: 'My Profile', to: '/profile' },
        { label: 'My Orders', to: '/orders' },
        { label: 'Logout', onClick: handleLogout },
      ]
    : [
        { label: 'Login', to: '/login' },
        { label: 'Register', to: '/signup' },
      ]

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        className="rounded-full border border-[#e0c99f] bg-white/85 p-2 text-[#8a7355] shadow-sm hover:bg-white"
        aria-label={user ? 'Open profile menu' : 'Open account menu'}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
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
          className="absolute right-0 top-full mt-2 w-44 rounded-2xl border border-[#e6d7bb] bg-white/95 p-2 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.45)]"
        >
          {menuItems.map((item) =>
            item.to ? (
              <Link
                key={item.label}
                to={item.to}
                role="menuitem"
                className="flex items-center rounded-xl px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-[#f7ebd4] hover:text-[#8a7355]"
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className="flex w-full items-center rounded-xl px-3 py-2 text-left text-sm text-zinc-700 transition-colors hover:bg-[#f7ebd4] hover:text-[#8a7355]"
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
    </div>
  )
}
