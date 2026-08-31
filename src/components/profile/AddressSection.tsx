import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { AddressCard } from '@/components/profile/AddressCard'
import { AddressForm } from '@/components/profile/AddressForm'
import { DeleteAddressConfirmation } from '@/components/profile/DeleteAddressConfirmation'
import type { ProfileAddress } from '@/lib/mockProfile'

type AddressSectionProps = {
  addresses: ProfileAddress[]
  loading: boolean
  /** Set when the address list itself failed to load. */
  error: string | null
  onRetry: () => void
  onAdd: (address: ProfileAddress) => Promise<string | null>
  onUpdate: (address: ProfileAddress) => Promise<string | null>
  onDelete: (id: string) => Promise<string | null>
  onSetDefault: (id: string) => Promise<string | null>
}

export function AddressSection({
  addresses,
  loading,
  error,
  onRetry,
  onAdd,
  onUpdate,
  onDelete,
  onSetDefault,
}: AddressSectionProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<ProfileAddress | undefined>(undefined)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [busyDefaultId, setBusyDefaultId] = useState<string | null>(null)

  const openAddForm = () => {
    setEditingAddress(undefined)
    setFormOpen(true)
  }

  const openEditForm = (address: ProfileAddress) => {
    setEditingAddress(address)
    setFormOpen(true)
  }

  /** Returns an error message to keep the form open, or null once the save succeeded. */
  const handleSave = async (address: ProfileAddress) => {
    const failure = editingAddress ? await onUpdate(address) : await onAdd(address)
    if (failure) return failure
    setFormOpen(false)
    return null
  }

  const handleSetDefault = async (id: string) => {
    setActionError(null)
    setBusyDefaultId(id)
    const failure = await onSetDefault(id)
    setBusyDefaultId(null)
    if (failure) setActionError(failure)
  }

  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return
    setDeleting(true)
    setDeleteError(null)
    const failure = await onDelete(pendingDeleteId)
    setDeleting(false)
    if (failure) {
      setDeleteError(failure)
      return
    }
    setPendingDeleteId(null)
  }

  return (
    <section className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="type-section-title">My Addresses</h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Saved addresses</p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 border border-zinc-200 px-6 py-12 text-center dark:border-zinc-800" role="status" aria-live="polite">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading addresses…</p>
        </div>
      ) : error ? (
        <div className="mt-6 border border-zinc-200 px-6 py-12 text-center dark:border-zinc-800" role="alert">
          <p className="font-semibold text-black dark:text-white">Unable to load addresses.</p>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{error}</p>
          <Button className="mt-6" onClick={onRetry}>
            Try Again
          </Button>
        </div>
      ) : addresses.length === 0 ? (
        <div className="mt-6 border border-dashed border-zinc-300 px-6 py-12 text-center dark:border-zinc-700">
          <p className="font-semibold text-black dark:text-white">No saved addresses</p>
          <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">You haven't added an address yet.</p>
          <Button className="mt-6" onClick={openAddForm}>
            + Add New Address
          </Button>
        </div>
      ) : (
        <>
          {actionError ? (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400" role="alert">
              {actionError}
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {addresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                busy={busyDefaultId === address.id}
                onEdit={() => openEditForm(address)}
                onDelete={() => {
                  setDeleteError(null)
                  setPendingDeleteId(address.id)
                }}
                onSetDefault={() => handleSetDefault(address.id)}
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

      <AddressForm
        isOpen={formOpen}
        initialAddress={editingAddress}
        onSave={handleSave}
        onClose={() => setFormOpen(false)}
      />

      <DeleteAddressConfirmation
        isOpen={pendingDeleteId !== null}
        deleting={deleting}
        error={deleteError}
        onCancel={() => {
          if (deleting) return
          setPendingDeleteId(null)
          setDeleteError(null)
        }}
        onConfirm={handleConfirmDelete}
      />
    </section>
  )
}
