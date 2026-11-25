'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { AdminTopbar } from '@/components/admin/AdminTopbar'
import { useAdminAuth } from '@/components/admin/AdminAuthProvider'

/**
 * The admin chrome — ported from the Vite `src/admin/layout/AdminLayout.tsx`.
 *
 * Same structure and the same class names, so `admin.css` lays it out identically:
 * `admin-shell` > (`admin-sidebar`, `admin-main` > (`admin-topbar`, `admin-content`)).
 * The mobile drawer state lives here, as in Vite, and closing it on navigation is passed
 * down as `onNavigate`.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A CLIENT COMPONENT WRAPPING SERVER-RENDERED CHILDREN
 * ──────────────────────────────────────────────────────────────────────────────
 * The drawer toggle and the logout button need a browser, so the chrome is client. The
 * PAGE inside it does not have to be: `children` arrives from the protected layout as
 * already-rendered Server Component output and stays server-rendered. So a later admin
 * screen can be a Server Component that fetches on the server, inside client chrome,
 * without this file changing.
 *
 * `<Outlet />` becomes `{children}` — the App Router's equivalent, and the only structural
 * difference from the original.
 *
 * ⚠️ RENDERING THIS GRANTS NOTHING. By the time it mounts, the protected layout has
 * already verified the session with the backend on the server. This file performs no check
 * of its own and must never be treated as one.
 */
export function AdminShell({ children }: { children: ReactNode }) {
  const { logout, adminUser } = useAdminAuth()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)

  /**
   * Sign out, then leave the admin area.
   *
   * `logout()` clears the shared session, the localStorage mirror and the httpOnly cookie
   * (see `AdminAuthProvider`). The navigation after it is `replace`, so Back does not
   * return to a page the session no longer permits — and because the cookie is gone, the
   * Edge proxy would bounce that attempt to the sign-in screen anyway.
   */
  const handleLogout = () => {
    logout()
    router.replace('/admin/login')
  }

  return (
    <div className="admin-shell">
      <AdminSidebar
        adminEmail={adminUser?.email}
        mobileOpen={mobileOpen}
        onLogout={handleLogout}
        onNavigate={() => setMobileOpen(false)}
      />

      <div className="admin-main">
        <AdminTopbar
          menuOpen={mobileOpen}
          onMenuToggle={() => setMobileOpen((open) => !open)}
          adminEmail={adminUser?.email}
        />

        <main className="admin-content">{children}</main>
      </div>
    </div>
  )
}
