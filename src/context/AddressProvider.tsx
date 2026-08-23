import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { MOCK_ADDRESSES, type ProfileAddress } from '@/lib/mockProfile'

type AddressCtx = {
  addresses: ProfileAddress[]
  /** Returns the saved address (with its generated id) so callers can select it immediately. */
  addAddress: (address: ProfileAddress) => ProfileAddress
  updateAddress: (address: ProfileAddress) => void
  deleteAddress: (id: string) => void
  setDefaultAddress: (id: string) => void
}

const Ctx = createContext<AddressCtx | null>(null)

/**
 * No Address API exists yet (see src/lib/mockProfile.ts). This is the single shared
 * in-memory source of truth for saved addresses, consumed by both the Profile Address
 * Book and Checkout's delivery-address selection, so adding/editing/deleting/defaulting
 * an address in either place is reflected in the other immediately. Replace with real
 * GET/CREATE/UPDATE/DELETE/SET-DEFAULT address API calls when the backend is ready —
 * the consuming components only depend on this hook's shape, not on how it's implemented.
 */
export function AddressProvider({ children }: { children: React.ReactNode }) {
  const [addresses, setAddresses] = useState<ProfileAddress[]>(MOCK_ADDRESSES)

  const addAddress = useCallback((address: ProfileAddress) => {
    const withId: ProfileAddress = { ...address, id: crypto.randomUUID() }
    setAddresses((prev) => {
      const makeDefault = withId.isDefault || prev.length === 0
      const next = makeDefault ? prev.map((a) => ({ ...a, isDefault: false })) : prev
      return [...next, { ...withId, isDefault: makeDefault }]
    })
    return withId
  }, [])

  const updateAddress = useCallback((address: ProfileAddress) => {
    setAddresses((prev) => {
      const next = prev.map((a) => (a.id === address.id ? address : a))
      if (!address.isDefault) return next
      return next.map((a) => (a.id === address.id ? a : { ...a, isDefault: false }))
    })
  }, [])

  const deleteAddress = useCallback((id: string) => {
    setAddresses((prev) => prev.filter((a) => a.id !== id))
  }, [])

  const setDefaultAddress = useCallback((id: string) => {
    setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })))
  }, [])

  const value = useMemo(
    () => ({ addresses, addAddress, updateAddress, deleteAddress, setDefaultAddress }),
    [addresses, addAddress, updateAddress, deleteAddress, setDefaultAddress],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAddresses() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAddresses requires AddressProvider')
  return ctx
}
