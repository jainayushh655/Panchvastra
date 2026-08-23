import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import {
  validateAddressLine1,
  validateCity,
  validateFullName,
  validateIndianPincode,
  validatePhoneIndia,
  validateState,
} from '@/lib/formValidation'
import { ADDRESS_TYPE_OPTIONS, createEmptyAddress, type ProfileAddress } from '@/lib/mockProfile'

type AddressFormProps = {
  isOpen: boolean
  /** Present when editing an existing address; omitted when adding a new one. */
  initialAddress?: ProfileAddress
  onSave: (address: ProfileAddress) => void
  onClose: () => void
}

type FieldErrors = Partial<Record<'fullName' | 'phone' | 'addressLine1' | 'city' | 'state' | 'postalCode', string>>

const inputCls =
  'w-full border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition-colors focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-white'

export function AddressForm({ isOpen, initialAddress, onSave, onClose }: AddressFormProps) {
  const [draft, setDraft] = useState<ProfileAddress>(initialAddress ?? createEmptyAddress())
  const [errors, setErrors] = useState<FieldErrors>({})

  useEffect(() => {
    if (!isOpen) return
    setDraft(initialAddress ?? createEmptyAddress())
    setErrors({})
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

  const isEditing = Boolean(initialAddress)

  const setField = <K extends keyof ProfileAddress>(key: K, value: ProfileAddress[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }))
    if (key in errors) setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    const nextErrors: FieldErrors = {}
    const fn = validateFullName(draft.fullName)
    if (fn) nextErrors.fullName = fn
    const ph = validatePhoneIndia(draft.phone)
    if (ph) nextErrors.phone = ph
    const l1 = validateAddressLine1(draft.addressLine1)
    if (l1) nextErrors.addressLine1 = l1
    const c = validateCity(draft.city)
    if (c) nextErrors.city = c
    const st = validateState(draft.state)
    if (st) nextErrors.state = st
    const pin = validateIndianPincode(draft.postalCode)
    if (pin) nextErrors.postalCode = pin

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    onSave(draft)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 px-4 py-8" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Edit address' : 'Add new address'}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg border border-zinc-200 bg-white p-6 shadow-[0_30px_60px_-36px_rgba(0,0,0,0.3)] dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 className="type-section-title">{isEditing ? 'Edit Address' : 'Add New Address'}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-600 transition-colors hover:border-black hover:text-black dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-white dark:hover:text-white"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-5">
          <div>
            <p className="type-label">Address Type</p>
            <div className="mt-2 flex gap-2">
              {ADDRESS_TYPE_OPTIONS.map((opt) => {
                const selected = draft.type === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setField('type', opt.value)}
                    className={`border px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
                      selected
                        ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                        : 'border-zinc-300 bg-white text-black hover:border-black dark:border-zinc-700 dark:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="addr-full-name" className="type-label">
                Full Name
              </label>
              <input
                id="addr-full-name"
                type="text"
                value={draft.fullName}
                onChange={(e) => setField('fullName', e.target.value)}
                className={`mt-1.5 ${inputCls}`}
              />
              {errors.fullName ? <p className="mt-1.5 text-xs text-red-600">{errors.fullName}</p> : null}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="addr-phone" className="type-label">
                Phone Number
              </label>
              <input
                id="addr-phone"
                type="tel"
                value={draft.phone}
                onChange={(e) => setField('phone', e.target.value)}
                className={`mt-1.5 ${inputCls}`}
              />
              {errors.phone ? <p className="mt-1.5 text-xs text-red-600">{errors.phone}</p> : null}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="addr-line1" className="type-label">
                Address Line 1
              </label>
              <input
                id="addr-line1"
                type="text"
                value={draft.addressLine1}
                onChange={(e) => setField('addressLine1', e.target.value)}
                className={`mt-1.5 ${inputCls}`}
              />
              {errors.addressLine1 ? <p className="mt-1.5 text-xs text-red-600">{errors.addressLine1}</p> : null}
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="addr-line2" className="type-label">
                Address Line 2
              </label>
              <input
                id="addr-line2"
                type="text"
                value={draft.addressLine2}
                onChange={(e) => setField('addressLine2', e.target.value)}
                className={`mt-1.5 ${inputCls}`}
              />
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="addr-landmark" className="type-label">
                Landmark
              </label>
              <input
                id="addr-landmark"
                type="text"
                value={draft.landmark}
                onChange={(e) => setField('landmark', e.target.value)}
                className={`mt-1.5 ${inputCls}`}
              />
            </div>

            <div>
              <label htmlFor="addr-city" className="type-label">
                City
              </label>
              <input
                id="addr-city"
                type="text"
                value={draft.city}
                onChange={(e) => setField('city', e.target.value)}
                className={`mt-1.5 ${inputCls}`}
              />
              {errors.city ? <p className="mt-1.5 text-xs text-red-600">{errors.city}</p> : null}
            </div>

            <div>
              <label htmlFor="addr-state" className="type-label">
                State
              </label>
              <input
                id="addr-state"
                type="text"
                value={draft.state}
                onChange={(e) => setField('state', e.target.value)}
                className={`mt-1.5 ${inputCls}`}
              />
              {errors.state ? <p className="mt-1.5 text-xs text-red-600">{errors.state}</p> : null}
            </div>

            <div>
              <label htmlFor="addr-pin" className="type-label">
                PIN Code
              </label>
              <input
                id="addr-pin"
                type="text"
                inputMode="numeric"
                value={draft.postalCode}
                onChange={(e) => setField('postalCode', e.target.value)}
                className={`mt-1.5 ${inputCls}`}
              />
              {errors.postalCode ? <p className="mt-1.5 text-xs text-red-600">{errors.postalCode}</p> : null}
            </div>

            <div>
              <label htmlFor="addr-country" className="type-label">
                Country
              </label>
              <select
                id="addr-country"
                value={draft.country}
                onChange={(e) => setField('country', e.target.value)}
                className={`mt-1.5 ${inputCls} cursor-pointer`}
              >
                <option value="India">India</option>
              </select>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={draft.isDefault}
              onChange={(e) => setField('isDefault', e.target.checked)}
              className="size-4 cursor-pointer accent-black"
            />
            <span className="font-sans text-sm text-zinc-700 dark:text-zinc-300">Set as default address</span>
          </label>

          <div className="flex justify-end gap-3 border-t border-zinc-200 pt-5 dark:border-zinc-800">
            <Button type="button" variant="ghostLight" onClick={onClose} className="border-zinc-300">
              Cancel
            </Button>
            <Button type="submit">{isEditing ? 'Update Address' : 'Save Address'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
