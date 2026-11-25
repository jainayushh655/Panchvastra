'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ADMIN_NAV, isAdminNavActive } from '@/lib/adminNav'

/**
 * The admin sidebar — ported from the Vite `src/admin/layout/AdminSidebar.tsx`.
 *
 * Every class name is the original's, so `admin.css` (copied byte-for-byte) styles it
 * identically: `admin-sidebar`, `is-open`, `admin-sidebar__brand`, `__nav`, `__link`,
 * `is-active`, `__footer`, `__backdrop`. The mobile drawer behaviour and the backdrop are
 * unchanged.
 *
 * Three things differ, all forced by the framework rather than chosen:
 *   - `NavLink` + `isActive` becomes `usePathname()` + `isAdminNavActive`, which also
 *     keeps a parent section active on a detail route the way `NavLink` did.
 *   - `react-router`'s `Link to=` becomes `next/link` `href=`.
 *   - An item whose route does not exist yet renders as disabled rather than as a link.
 *     See `lib/adminNav.ts` for why that is the honest option.
 */
export function AdminSidebar({
  adminEmail,
  mobileOpen,
  onLogout,
  onNavigate,
}: {
  adminEmail?: string | null
  mobileOpen: boolean
  onLogout: () => void
  onNavigate?: () => void
}) {
  const pathname = usePathname()

  return (
    <>
      {/*
        The backdrop is a real <button>, as in Vite: it is a dismiss control, so it has to
        be reachable by keyboard and announced, not a div with a click handler.
      */}
      {mobileOpen ? (
        <button
          type="button"
          className="admin-sidebar__backdrop"
          aria-label="Close navigation menu"
          onClick={onNavigate}
        />
      ) : null}

      <aside className={`admin-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div>
          <Link href="/admin/dashboard" className="admin-sidebar__brand" onClick={onNavigate}>
            Panchvastra
            <span>Admin</span>
          </Link>
        </div>

        <nav className="admin-sidebar__nav" aria-label="Admin sections">
          {ADMIN_NAV.map((item) => {
            if (!item.ready) {
              /*
               * Not a link, not focusable, and labelled as unavailable. `aria-disabled`
               * alone would still put it in the tab order, so it is a <span>: there is
               * nothing here to activate, and offering focus would be a lie.
               */
              return (
                <span
                  key={item.href}
                  className="admin-sidebar__link is-pending"
                  aria-disabled="true"
                  title="Migrating in a later phase"
                >
                  {item.label}
                  <em className="admin-sidebar__soon">Soon</em>
                </span>
              )
            }

            const active = isAdminNavActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`admin-sidebar__link${active ? ' is-active' : ''}`}
                // The styling already marks the active item; this is what a screen reader
                // needs to hear it, and `NavLink` did not provide it either.
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="admin-sidebar__footer">
          <p>{adminEmail ?? 'Admin'}</p>
          <button type="button" onClick={onLogout}>
            Logout
          </button>
        </div>
      </aside>
    </>
  )
}
