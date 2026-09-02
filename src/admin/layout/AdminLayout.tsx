import { Outlet, useNavigate } from 'react-router-dom'
import { useAdminAuth } from '@/admin/hooks/useAdminAuth'
import { useState } from 'react'
import { AdminSidebar } from './AdminSidebar'
import { AdminTopbar } from './AdminTopbar'

const sidebarLinks = [
  { to: '/admin/dashboard', label: 'Dashboard' },
  { to: '/admin/products', label: 'Products' },
  { to: '/admin/categories', label: 'Categories' },
  { to: '/admin/sub-categories', label: 'Sub-Categories' },
  { to: '/admin/coupons', label: 'Coupons' },
]

export function AdminLayout() {
  const { logout, adminUser } = useAdminAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/admin/login')
  }

  return (
    <div className="admin-shell">
      <AdminSidebar
        links={sidebarLinks}
        adminEmail={adminUser?.email}
        mobileOpen={mobileOpen}
        onLogout={handleLogout}
        onNavigate={() => setMobileOpen(false)}
      />

      <div className="admin-main">
        <AdminTopbar menuOpen={mobileOpen} onMenuToggle={() => setMobileOpen((open) => !open)} />

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
