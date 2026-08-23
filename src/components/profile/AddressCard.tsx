import { ADDRESS_TYPE_OPTIONS, type ProfileAddress } from '@/lib/mockProfile'

type AddressCardProps = {
  address: ProfileAddress
  onEdit?: () => void
  onDelete?: () => void
  onSetDefault?: () => void
  /** 'manage' (default) is the Profile Address Book card. 'checkout' swaps the Edit/Delete
   * row for a single Change Address action, used for the selected-address summary at the
   * top of Checkout. */
  variant?: 'manage' | 'checkout'
  onChangeAddress?: () => void
}

export function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  variant = 'manage',
  onChangeAddress,
}: AddressCardProps) {
  const typeLabel = ADDRESS_TYPE_OPTIONS.find((t) => t.value === address.type)?.label ?? address.type

  return (
    <div className="flex flex-col border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-3">
        <span className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-black dark:text-white">
          {typeLabel}
        </span>
        {address.isDefault ? (
          <span className="border border-zinc-300 px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            Default
          </span>
        ) : variant === 'manage' ? (
          <button
            type="button"
            onClick={onSetDefault}
            className="font-sans text-[11px] font-semibold uppercase tracking-wide text-zinc-500 underline underline-offset-2 transition-colors hover:text-black dark:text-zinc-500 dark:hover:text-white"
          >
            Set as default
          </button>
        ) : null}
      </div>

      <div className="mt-4 space-y-0.5 font-sans text-sm text-zinc-700 dark:text-zinc-300">
        <p className="font-semibold text-black dark:text-white">{address.fullName}</p>
        <p>{address.addressLine1}</p>
        {address.addressLine2 ? <p>{address.addressLine2}</p> : null}
        {address.landmark ? <p>{address.landmark}</p> : null}
        <p>
          {address.city}, {address.state} - {address.postalCode}
        </p>
        <p>{address.country}</p>
        <p className="pt-1.5 text-zinc-500 dark:text-zinc-500">{address.phone}</p>
      </div>

      {variant === 'manage' ? (
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-900">
          <button
            type="button"
            onClick={onEdit}
            className="font-sans text-xs font-bold uppercase tracking-wide text-black underline underline-offset-2 dark:text-white"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="font-sans text-xs font-bold uppercase tracking-wide text-zinc-500 underline underline-offset-2 transition-colors hover:text-black dark:hover:text-white"
          >
            Delete
          </button>
        </div>
      ) : (
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-zinc-100 pt-4 dark:border-zinc-900">
          <button
            type="button"
            onClick={onEdit}
            className="font-sans text-xs font-bold uppercase tracking-wide text-black underline underline-offset-2 dark:text-white"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onChangeAddress}
            className="font-sans text-xs font-bold uppercase tracking-wide text-black underline underline-offset-2 dark:text-white"
          >
            Change Address
          </button>
        </div>
      )}
    </div>
  )
}
