/** Shared loading / error / empty state blocks so every admin list behaves consistently. */

export function AdminLoadingState({ rows = 6 }: { rows?: number }) {
  return (
    <div className="admin-skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Loading…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="admin-skeleton__row" style={{ width: `${100 - i * 6}%` }} />
      ))}
    </div>
  )
}

export function AdminErrorState({
  title = 'Unable to load data',
  message,
  onRetry,
}: {
  title?: string
  message: string
  onRetry?: () => void
}) {
  return (
    <div className="admin-state" role="alert">
      <h3>{title}</h3>
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="admin-btn" onClick={onRetry}>
          Try Again
        </button>
      ) : null}
    </div>
  )
}

export function AdminEmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="admin-state">
      <h3>{title}</h3>
      <p>{message}</p>
    </div>
  )
}

/**
 * Monochrome status badge. `tone` maps to fill/outline/subtle variants rather than
 * colour-coding, per the admin design system.
 */
export function AdminBadge({ label, tone = 'subtle' }: { label: string; tone?: 'solid' | 'outline' | 'subtle' }) {
  const cls = tone === 'solid' ? 'admin-badge admin-badge--solid' : tone === 'outline' ? 'admin-badge admin-badge--outline' : 'admin-badge'
  return <span className={cls}>{label}</span>
}
