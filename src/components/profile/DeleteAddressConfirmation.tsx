import { useEffect } from 'react'
import { Button } from '@/components/ui/Button'

type DeleteAddressConfirmationProps = {
  isOpen: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteAddressConfirmation({ isOpen, onConfirm, onCancel }: DeleteAddressConfirmationProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-6" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Delete address"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm border border-zinc-200 bg-white p-6 text-center shadow-[0_30px_60px_-36px_rgba(0,0,0,0.3)] dark:border-zinc-800 dark:bg-zinc-950"
      >
        <p className="text-base font-semibold text-black dark:text-white">Delete this address?</p>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">This action can't be undone.</p>

        <div className="mt-6 flex justify-center gap-3">
          <Button type="button" variant="ghostLight" onClick={onCancel} className="border-zinc-300">
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm}>
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}
