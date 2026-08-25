import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  createAddress,
  deleteAddress as deleteAddressRequest,
  getAddresses,
  readAddressApiError,
  updateAddress as updateAddressRequest,
} from '@/api/address'
import { mapAddress, toAddressCreateDto, toAddressUpdateDto } from '@/mappers/addressMapper'
import { useAuth } from '@/context/AuthProvider'
import type { ProfileAddress } from '@/lib/mockProfile'

/** Mutations resolve to an error message, or null on success. */
type MutationResult = Promise<string | null>

type AddressCtx = {
  addresses: ProfileAddress[]
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  /** Resolves to `{ error }` plus the created address once the list has been re-fetched. */
  addAddress: (address: ProfileAddress) => Promise<{ error: string | null; created: ProfileAddress | null }>
  updateAddress: (address: ProfileAddress) => MutationResult
  deleteAddress: (id: string) => MutationResult
  setDefaultAddress: (id: string) => MutationResult
}

const Ctx = createContext<AddressCtx | null>(null)

/**
 * Single shared source of truth for saved addresses, backed by the real
 * /v1/address_management/ API and consumed by both the Profile Address Book and
 * Checkout's delivery-address selection.
 *
 * The backend owns default-address behaviour (create sets the new address as default;
 * `is_default: true` on update unsets the previous default; deleting the default promotes
 * another). Every mutation therefore re-fetches the list instead of recomputing those
 * rules locally, so the UI always reflects the server.
 */
export function AddressProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  const [addresses, setAddresses] = useState<ProfileAddress[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)

  const load = useCallback(async () => {
    if (!token) {
      setAddresses([])
      setError(null)
      setLoading(false)
      return
    }

    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const dtos = await getAddresses()
      if (current !== requestId.current) return
      setAddresses(dtos.map(mapAddress))
    } catch (err) {
      if (current !== requestId.current) return
      setAddresses([])
      setError(readAddressApiError(err, 'Unable to load addresses.'))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [token])

  // Loads on mount and whenever the signed-in session changes.
  useEffect(() => {
    void load()
  }, [load])

  const addAddress = useCallback(
    async (address: ProfileAddress) => {
      try {
        const created = await createAddress(toAddressCreateDto(address))
        const dtos = await getAddresses()
        const mapped = dtos.map(mapAddress)
        setAddresses(mapped)
        setError(null)

        // Prefer the id the create response reported; otherwise fall back to whichever
        // address the backend now marks default (creation makes the new one default).
        const createdId = created ? String(created.id) : null
        const match =
          (createdId ? mapped.find((a) => a.id === createdId) : undefined) ??
          mapped.find((a) => a.isDefault) ??
          null

        return { error: null, created: match }
      } catch (err) {
        return { error: readAddressApiError(err, 'Unable to save this address.'), created: null }
      }
    },
    [],
  )

  const updateAddress = useCallback(async (address: ProfileAddress) => {
    try {
      await updateAddressRequest(toAddressUpdateDto(address))
      await load()
      return null
    } catch (err) {
      return readAddressApiError(err, 'Unable to update this address.')
    }
  }, [load])

  const deleteAddress = useCallback(async (id: string) => {
    try {
      await deleteAddressRequest(id)
      await load()
      return null
    } catch (err) {
      return readAddressApiError(err, 'Unable to delete this address.')
    }
  }, [load])

  /** Promotes an address by re-sending it with `is_default: true`; the backend clears the rest. */
  const setDefaultAddress = useCallback(
    async (id: string) => {
      const target = addresses.find((a) => a.id === id)
      if (!target) return 'That address is no longer available.'

      try {
        await updateAddressRequest(toAddressUpdateDto({ ...target, isDefault: true }))
        await load()
        return null
      } catch (err) {
        return readAddressApiError(err, 'Unable to set this address as default.')
      }
    },
    [addresses, load],
  )

  const value = useMemo(
    () => ({
      addresses,
      loading,
      error,
      refresh: load,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
    }),
    [addresses, loading, error, load, addAddress, updateAddress, deleteAddress, setDefaultAddress],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAddresses() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAddresses requires AddressProvider')
  return ctx
}
