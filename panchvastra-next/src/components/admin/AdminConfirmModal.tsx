'use client'

import { useEffect } from 'react'

/**
 * Confirmation dialog for destructive admin actions — ported from the Vite
 * `src/admin/components/AdminConfirmModal.tsx`.
 *
 * Unchanged: the `admin-modal__backdrop` / `admin-modal` markup, `role="dialog"`,
 * `aria-modal`, the `aria-label` from the title, Escape-to-cancel, backdrop-click to
 * cancel, and `stopPropagation` on the panel so a click inside does not dismiss it.
 *
 * Migrated now because it is genuinely shared — every management screen with a delete
 * uses it — and because its keyboard behaviour is the kind of thing that gets dropped when
 * it is rebuilt per screen.
 */
export function AdminConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onCancel])

  if (!isOpen) return null

  return (
    <div className="admin-modal__backdrop" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="admin-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{title}</h3>
        <p>{message}</p>
        <div className="admin-modal__actions">
          <button type="button" className="admin-btn--ghost" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="admin-btn" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
