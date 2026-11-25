'use client'

/**
 * Shared loading / error / empty / badge blocks — ported from the Vite
 * `src/admin/components/AdminStates.tsx`, unchanged in markup and classes.
 *
 * They exist so every admin list behaves and reads the same way.
 *
 * WHY THIS FILE IS A CLIENT COMPONENT even though three of the four are stateless:
 * `AdminErrorState` takes an `onRetry` handler. In a Server Component that `onClick`
 * would be dropped silently — the button would render, look live, and do nothing, which
 * is exactly the kind of fake affordance this migration is not allowed to ship. Marking
 * the file client makes the retry real. The cost is a few hundred bytes on admin routes
 * only, which sit behind a server guard and are never reached by a shopper.
 */

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
  const cls =
    tone === 'solid'
      ? 'admin-badge admin-badge--solid'
      : tone === 'outline'
        ? 'admin-badge admin-badge--outline'
        : 'admin-badge'
  return <span className={cls}>{label}</span>
}
