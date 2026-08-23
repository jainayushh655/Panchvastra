import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ADDRESS_TYPE_OPTIONS, type ProfileAddress } from '@/lib/mockProfile'

type AddressPickerModalProps = {
  isOpen: boolean
  addresses: ProfileAddress[]
  selectedId: string | null
  onSelect: (id: string) => void
  onClose: () => void
}

export function AddressPickerModal({ isOpen, addresses, selectedId, onSelect, onClose }: AddressPickerModalProps) {
  const [pickedId, setPickedId] = useState<string | null>(selectedId)

  useEffect(() => {
    if (!isOpen) return
    setPickedId(selectedId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (!pickedId) return
    onSelect(pickedId)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Select delivery address"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg border border-zinc-200 bg-white p-6 shadow-[0_30px_60px_-36px_rgba(0,0,0,0.3)] dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="type-section-title">Select Delivery Address</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition-colors hover:border-black hover:text-black dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-white dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 max-h-[60vh] space-y-3 overflow-y-auto">
          {addresses.map((address) => {
            const typeLabel = ADDRESS_TYPE_OPTIONS.find((t) => t.value === address.type)?.label ?? address.type
            const picked = pickedId === address.id
            return (
              <label
                key={address.id}
                className={`flex cursor-pointer gap-3 border p-4 transition-colors ${
                  picked ? 'border-black dark:border-white' : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600'
                }`}
              >
                <input
                  type="radio"
                  name="checkout-address-picker"
                  checked={picked}
                  onChange={() => setPickedId(address.id)}
                  className="mt-1 size-4 shrink-0 cursor-pointer accent-black"
                />
                <div className="min-w-0 font-sans text-sm text-zinc-700 dark:text-zinc-300">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-[0.14em] text-black dark:text-white">
                      {typeLabel}
                    </span>
                    {address.isDefault ? (
                      <span className="border border-zinc-300 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 font-semibold text-black dark:text-white">{address.fullName}</p>
                  <p>{address.addressLine1}</p>
                  <p>
                    {address.city}, {address.state} - {address.postalCode}
                  </p>
                </div>
              </label>
            )
          })}
        </div>

        <div className="mt-6 flex justify-end gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          <Button type="button" variant="ghostLight" onClick={onClose} className="border-zinc-300">
            Cancel
          </Button>
          <Button type="button" onClick={handleConfirm} disabled={!pickedId}>
            Select Address
          </Button>
        </div>
      </div>
    </div>
  )
}
