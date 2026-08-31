import { Link, NavLink } from 'react-router-dom'

type SidebarLink = {
  to: string
  label: string
}

type AdminSidebarProps = {
  links: SidebarLink[]
  adminEmail?: string | null
  mobileOpen: boolean
  onLogout: () => void
  onNavigate?: () => void
}

export function AdminSidebar({ links, adminEmail, mobileOpen, onLogout, onNavigate }: AdminSidebarProps) {
  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="admin-sidebar__backdrop"
          aria-label="Close navigation menu"
          onClick={onNavigate}
        />
      ) : null}

      <aside
        className={`admin-sidebar ${mobileOpen ? 'is-open' : ''}`}
        aria-hidden={undefined}
      >
        <div>
          <Link to="/admin/dashboard" className="admin-sidebar__brand" onClick={onNavigate}>
            Panchvastra
            <span>Admin</span>
          </Link>
        </div>

        <nav className="admin-sidebar__nav" aria-label="Admin sections">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `admin-sidebar__link${isActive ? ' is-active' : ''}`}
              onClick={onNavigate}
            >
              {link.label}
            </NavLink>
          ))}
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
