type AdminTopbarProps = {
  onMenuToggle: () => void
  menuOpen?: boolean
}

export function AdminTopbar({ onMenuToggle, menuOpen = false }: AdminTopbarProps) {
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
        <span className="admin-topbar__pill">Catalog Live</span>
      </div>
    </header>
  )
}
