import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { AdminCatalogSyncBanner } from '@/admin/AdminCatalogSyncBanner'
import { clearAdminSession } from '@/lib/adminAuth'

const nav = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/homepage', label: 'Homepage' },
  { to: '/admin/orders', label: 'Orders' },
]

export function AdminLayout() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-svh bg-zinc-950 text-zinc-100">
      <aside className="relative w-52 shrink-0 border-r border-zinc-800 bg-zinc-900/90 px-3 py-6">
        <p className="type-eyebrow px-3 text-orange-400">PANCHVASTRA</p>
        <nav className="mt-8 flex flex-col gap-1">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  isActive ? 'bg-orange-500/20 text-orange-300' : 'text-zinc-400 hover:bg-zinc-800'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          className="absolute bottom-6 left-3 right-3 rounded-xl border border-zinc-700 py-2 text-xs font-semibold text-zinc-400 hover:bg-zinc-800"
          onClick={() => {
            clearAdminSession()
            navigate('/admin/login', { replace: true })
          }}
        >
          Sign out
        </button>
      </aside>
      <div className="max-h-screen flex-1 overflow-y-auto p-6 md:p-10">
        <AdminCatalogSyncBanner />
        <Outlet />
      </div>
    </div>
  )
}
