import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { AddressCard } from '@/components/profile/AddressCard'
import { AddressForm } from '@/components/profile/AddressForm'
import { AddressPickerModal } from '@/components/checkout/AddressPickerModal'
import type { ProfileAddress } from '@/lib/mockProfile'

type DeliveryAddressSectionProps = {
  addresses: ProfileAddress[]
  selectedAddressId: string | null
  onSelectAddress: (id: string) => void
  onAddAddress: (address: ProfileAddress) => ProfileAddress
  onUpdateAddress: (address: ProfileAddress) => void
  error?: string | null
}

export function DeliveryAddressSection({
  addresses,
  selectedAddressId,
  onSelectAddress,
  onAddAddress,
  onUpdateAddress,
  error,
}: DeliveryAddressSectionProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<ProfileAddress | undefined>(undefined)
  const [pickerOpen, setPickerOpen] = useState(false)

  const selected = addresses.find((a) => a.id === selectedAddressId) ?? addresses[0]

  const openAddForm = () => {
    setEditingAddress(undefined)
    setFormOpen(true)
  }

  const openEditForm = () => {
    if (!selected) return
    setEditingAddress(selected)
    setFormOpen(true)
  }

  const handleSave = (address: ProfileAddress) => {
    if (editingAddress) {
      onUpdateAddress(address)
      onSelectAddress(address.id)
    } else {
      const saved = onAddAddress(address)
      onSelectAddress(saved.id)
    }
    setFormOpen(false)
  }

  return (
    <section className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="type-section-title">Delivery Address</h2>

      <div className="mt-5">
        {!selected ? (
          <div className="border border-dashed border-zinc-300 px-6 py-10 text-center dark:border-zinc-700">
            <p className="font-semibold text-black dark:text-white">No saved address</p>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
              Please add a delivery address before continuing.
            </p>
            <Button className="mt-6" onClick={openAddForm}>
              + Add New Address
            </Button>
          </div>
        ) : (
          <>
            <AddressCard
              address={selected}
              variant="checkout"
              onEdit={openEditForm}
              onChangeAddress={() => setPickerOpen(true)}
            />
            <div className="mt-4">
              <Button variant="outline" size="sm" onClick={openAddForm}>
                + Add New Address
              </Button>
            </div>
          </>
        )}

        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>

      <AddressForm isOpen={formOpen} initialAddress={editingAddress} onSave={handleSave} onClose={() => setFormOpen(false)} />

      <AddressPickerModal
        isOpen={pickerOpen}
        addresses={addresses}
        selectedId={selected?.id ?? null}
        onSelect={onSelectAddress}
        onClose={() => setPickerOpen(false)}
      />
    </section>
  )
}
