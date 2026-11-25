'use client'

/**
 * The admin topbar — ported from the Vite `src/admin/layout/AdminTopbar.tsx`.
 *
 * Unchanged in markup, classes and behaviour: the hamburger that toggles the mobile
 * drawer, the title, and the status pill. `aria-expanded` and the label that flips between
 * "Open"/"Close navigation menu" come from the original and are kept.
 *
 * ONE DELIBERATE CHANGE. The Vite version's pill read "Catalog Live" unconditionally — a
 * hardcoded string that asserted something about the system without checking it. This
 * renders the signed-in admin's own email instead, which is a fact the shell actually
 * has, and drops the claim. A status indicator that is always green is not a status
 * indicator.
 */
export function AdminTopbar({
  onMenuToggle,
  menuOpen = false,
  adminEmail,
}: {
  onMenuToggle: () => void
  menuOpen?: boolean
  adminEmail?: string | null
}) {
  return (
    <header className="admin-topbar">
      <button
        type="button"
        className="admin-topbar__menu"
        onClick={onMenuToggle}
        aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        aria-expanded={menuOpen}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <div className="admin-topbar__title">Panchvastra Admin</div>
      <div className="admin-topbar__actions">
        {adminEmail ? <span className="admin-topbar__pill">{adminEmail}</span> : null}
      </div>
    </header>
  )
}
