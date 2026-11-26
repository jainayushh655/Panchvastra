import { useEffect } from 'react'
import { OVERLAY_Z, Portal } from '@/components/ui/Portal'
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock'
import { Button } from '@/components/ui/Button'

type LogoutConfirmationProps = {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function LogoutConfirmation({ isOpen, onConfirm, onCancel }: LogoutConfirmationProps) {
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onCancel])

  // Freezes the page behind the dialog. Shared and reference-counted, because these
  // dialogs stack (the address picker opens the address form over itself) and a
  // per-component save-and-restore unlocks the page while one is still open.
  useBodyScrollLock(isOpen)

  if (!isOpen) return null

  /* Portalled to `document.body` — see `Portal` for why a `z-index` alone cannot keep
     an overlay above the page it covers. */
  return (
    <Portal>
      <div className={`fixed inset-0 ${OVERLAY_Z.modal} flex items-center justify-center bg-black/35 px-4 py-6`} onClick={onCancel}>
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm logout"
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-sm border border-zinc-200 bg-white p-6 text-center shadow-[0_30px_60px_-36px_rgba(0,0,0,0.3)] dark:border-zinc-800 dark:bg-zinc-950"
        >
          <p className="text-base font-semibold text-black dark:text-white">Are you sure you want to logout?</p>

          <div className="mt-6 flex justify-center gap-3">
            <Button type="button" variant="ghostLight" onClick={onCancel} className="border-zinc-300">
              Cancel
            </Button>
            <Button type="button" onClick={onConfirm}>
              Logout
            </Button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
