type AdminTopbarProps = {
  onMenuToggle: () => void
}

export function AdminTopbar({ onMenuToggle }: AdminTopbarProps) {
  return (
    <header className="admin-topbar">
      <button type="button" className="admin-topbar__menu" onClick={onMenuToggle}>
        ☰
      </button>
      <div className="admin-topbar__title">Premium Operations</div>
      <div className="admin-topbar__actions">
        <span className="admin-topbar__pill">Live Preview</span>
      </div>
    </header>
  )
}
