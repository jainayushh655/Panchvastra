import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { AddressCard } from '@/components/profile/AddressCard'
import { AddressForm } from '@/components/profile/AddressForm'
import { DeleteAddressConfirmation } from '@/components/profile/DeleteAddressConfirmation'
import type { ProfileAddress } from '@/lib/mockProfile'

type AddressSectionProps = {
  addresses: ProfileAddress[]
  onAdd: (address: ProfileAddress) => void
  onUpdate: (address: ProfileAddress) => void
  onDelete: (id: string) => void
  onSetDefault: (id: string) => void
}

export function AddressSection({ addresses, onAdd, onUpdate, onDelete, onSetDefault }: AddressSectionProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<ProfileAddress | undefined>(undefined)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const openAddForm = () => {
    setEditingAddress(undefined)
    setFormOpen(true)
  }

  const openEditForm = (address: ProfileAddress) => {
    setEditingAddress(address)
    setFormOpen(true)
  }

  const handleSave = (address: ProfileAddress) => {
    if (editingAddress) {
      onUpdate(address)
    } else {
      onAdd(address)
    }
    setFormOpen(false)
  }

  return (
    <section className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="type-section-title">My Addresses</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Saved addresses</p>
        </div>
      </div>

      {addresses.length === 0 ? (
        <div className="mt-6 border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
          <p className="font-semibold text-black dark:text-white">No saved addresses</p>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">You haven't added an address yet.</p>
          <Button className="mt-6" onClick={openAddForm}>
            + Add New Address
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {addresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                onEdit={() => openEditForm(address)}
                onDelete={() => setPendingDeleteId(address.id)}
                onSetDefault={() => onSetDefault(address.id)}
              />
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            <Button variant="outline" onClick={openAddForm}>
              + Add New Address
            </Button>
          </div>
        </>
      )}

      <AddressForm isOpen={formOpen} initialAddress={editingAddress} onSave={handleSave} onClose={() => setFormOpen(false)} />

      <DeleteAddressConfirmation
        isOpen={pendingDeleteId !== null}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => {
          if (pendingDeleteId) onDelete(pendingDeleteId)
          setPendingDeleteId(null)
        }}
      />
    </section>
  )
}
