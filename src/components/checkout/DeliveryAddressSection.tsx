import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { AddressForm } from '@/components/profile/AddressForm'
import { AddressPickerModal } from '@/components/checkout/AddressPickerModal'
import type { ProfileAddress } from '@/lib/mockProfile'

/**
 * The address as one line: "24 Example Road, Bhopal, Madhya Pradesh 462001".
 *
 * Only parts the address actually has are joined, so a missing line 2 or landmark leaves
 * no stray comma. State and pincode share a segment because they read as one unit, and
 * country is left out — this is a domestic storefront and the summary row is a glance,
 * not the full record (the edit form still holds every field).
 */
function formatAddressLine(address: ProfileAddress): string {
  const statePin = [address.state, address.postalCode].filter(Boolean).join(' ')
  return [address.addressLine1, address.addressLine2, address.landmark, address.city, statePin]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')
}

type DeliveryAddressSectionProps = {
  addresses: ProfileAddress[]
  loading: boolean
  /** Set when the address list itself failed to load. */
  loadError: string | null
  onRetry: () => void
  selectedAddressId: string | null
  onSelectAddress: (id: string) => void
  /** Persists a new address and resolves with the created record once the list refreshed. */
  onAddAddress: (address: ProfileAddress) => Promise<{ error: string | null; created: ProfileAddress | null }>
  onUpdateAddress: (address: ProfileAddress) => Promise<string | null>
  error?: string | null
}

export function DeliveryAddressSection({
  addresses,
  loading,
  loadError,
  onRetry,
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

  /** Returns an error message to keep the form open, or null once the save succeeded. */
  const handleSave = async (address: ProfileAddress) => {
    if (editingAddress) {
      const failure = await onUpdateAddress(address)
      if (failure) return failure
      onSelectAddress(address.id)
    } else {
      const { error: failure, created } = await onAddAddress(address)
      if (failure) return failure
      // Select whatever the refreshed backend list reports as the new address.
      if (created) onSelectAddress(created.id)
    }

    setFormOpen(false)
    return null
  }

  return (
    <section className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="type-section-title">Delivery Address</h2>
        {/* Shown only once there is an address to add ANOTHER one to — the empty state
            below has its own, more prominent call to action. */}
        {!loading && !loadError && selected ? (
          <button
            type="button"
            onClick={openAddForm}
            className="inline-flex min-h-[32px] items-center font-sans text-xs font-semibold text-black underline underline-offset-2 dark:text-white"
          >
            + Add another address
          </button>
        ) : null}
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="border border-zinc-200 px-6 py-10 text-center dark:border-zinc-800" role="status" aria-live="polite">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading addresses…</p>
          </div>
        ) : loadError ? (
          <div className="border border-zinc-200 px-6 py-10 text-center dark:border-zinc-800" role="alert">
            <p className="font-semibold text-black dark:text-white">Unable to load addresses.</p>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{loadError}</p>
            <Button className="mt-6" onClick={onRetry}>
              Try Again
            </Button>
          </div>
        ) : !selected ? (
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
          <div className="space-y-3">
            {/*
              The selected address, presented as the chosen option in a list rather than as
              a standalone card. The radio is decorative-but-real: it is a genuine checked
              input so the row reads as "this is the one selected", while choosing a
              DIFFERENT address still goes through the existing picker via "Change" — that
              modal is where the full list, and its own selection handling, already lives.
            */}
            <div className="border border-zinc-300 p-4 dark:border-zinc-700">
              <div className="flex items-start gap-3">
                <input
                  type="radio"
                  name="delivery-address"
                  checked
                  readOnly
                  aria-label={`Delivering to ${selected.fullName}`}
                  className="mt-1 size-4 shrink-0 accent-black"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="font-sans text-sm font-bold text-black dark:text-white">{selected.fullName}</p>
                    {selected.isDefault ? (
                      <span className="bg-zinc-100 px-2 py-0.5 font-sans text-[10px] font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                        Default
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 font-sans text-sm text-zinc-600 dark:text-zinc-400">
                    {formatAddressLine(selected)}
                  </p>
                  {selected.phone ? (
                    <p className="mt-1 font-sans text-sm text-zinc-500 dark:text-zinc-500">{selected.phone}</p>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={openEditForm}
                    className="inline-flex min-h-[32px] items-center font-sans text-xs font-semibold text-black underline underline-offset-2 dark:text-white"
                  >
                    Edit
                  </button>
                  <span className="text-zinc-300 dark:text-zinc-700" aria-hidden>
                    |
                  </span>
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="inline-flex min-h-[32px] items-center font-sans text-xs font-semibold text-black underline underline-offset-2 dark:text-white"
                  >
                    Change
                  </button>
                </div>
              </div>
            </div>

            {/* Reads as the next option in the same list, and opens the same add form the
                header link does. */}
            <button
              type="button"
              onClick={openAddForm}
              className="flex w-full items-start gap-3 border border-zinc-200 p-4 text-left transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
            >
              <span
                className="mt-1 size-4 shrink-0 rounded-full border border-zinc-300 dark:border-zinc-700"
                aria-hidden
              />
              <span className="mt-0.5 shrink-0 font-sans text-base leading-none text-zinc-500" aria-hidden>
                +
              </span>
              <span className="min-w-0">
                <span className="block font-sans text-sm font-bold text-black dark:text-white">
                  Add a new delivery address
                </span>
                <span className="mt-0.5 block font-sans text-sm text-zinc-500 dark:text-zinc-400">
                  Add an address to see available delivery options.
                </span>
              </span>
            </button>
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
      </div>

      <AddressForm
        isOpen={formOpen}
        initialAddress={editingAddress}
        onSave={handleSave}
        onClose={() => setFormOpen(false)}
      />

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
