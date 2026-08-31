import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ProfileInfoSection } from '@/components/profile/ProfileInfoSection'
import { AddressSection } from '@/components/profile/AddressSection'
import { getProfile, readProfileApiError, updateProfile } from '@/api/profile'
import { mapUserProfile, toProfileFormData } from '@/mappers/userProfileMapper'
import { useAddresses } from '@/context/AddressProvider'
import { useAuth } from '@/context/AuthProvider'
import { useCart } from '@/context/CartProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { createEmptyProfile, type ProfileInfo } from '@/lib/mockProfile'

export function ProfilePage() {
  useDocumentTitle('My Profile')
  const { user, token, logout } = useAuth()
  const { clear } = useCart()
  const navigate = useNavigate()

  // Personal information comes from the real /v1/user_profile/ API. The backend is the
  // source of truth: every successful update is followed by a re-fetch.
  const [profile, setProfile] = useState<ProfileInfo>(createEmptyProfile)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)

  const sessionEmail = user?.email ?? ''

  const loadProfile = useCallback(async () => {
    if (!token) {
      setProfile({ ...createEmptyProfile(), email: sessionEmail })
      setProfileError(null)
      setProfileLoading(false)
      return
    }

    const current = ++requestId.current
    setProfileLoading(true)
    setProfileError(null)

    try {
      const dto = await getProfile()
      if (current !== requestId.current) return
      setProfile(mapUserProfile(dto, sessionEmail))
    } catch (err) {
      if (current !== requestId.current) return
      setProfileError(readProfileApiError(err, 'Unable to load profile.'))
    } finally {
      if (current === requestId.current) setProfileLoading(false)
    }
  }, [sessionEmail, token])

  // Loads on mount and whenever the signed-in session changes. Never submits on load.
  useEffect(() => {
    void loadProfile()
  }, [loadProfile])

  /** Returns an error message to keep the form open, or null once the save succeeded. */
  const handleSaveProfile = async (next: ProfileInfo, imageFile: File | null) => {
    try {
      await updateProfile(toProfileFormData(next, imageFile))
    } catch (err) {
      return readProfileApiError(err, 'Unable to save your profile.')
    }

    // The PUT response is not assumed to carry the full record — re-read it.
    await loadProfile()
    return null
  }

  // Shared with Checkout's delivery-address selection — see AddressProvider.
  const {
    addresses,
    loading: addressesLoading,
    error: addressesError,
    refresh: refreshAddresses,
    addAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  } = useAddresses()

  const handleLogout = () => {
    clear()
    logout()
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <p className="type-eyebrow">Account</p>
      <h1 className="type-page-title mt-2">Account</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
        Welcome back{profile.firstName ? `, ${profile.firstName}` : ''}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <ProfileInfoSection
          profile={profile}
          loading={profileLoading}
          error={profileError}
          onRetry={loadProfile}
          onSave={handleSaveProfile}
        />

        <section className="h-fit border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="type-section-title">Account Actions</h2>
          <Button variant="outline" className="mt-5 w-full" onClick={handleLogout}>
            Logout
          </Button>
        </section>
      </div>

      <div className="mt-6">
        <AddressSection
          addresses={addresses}
          loading={addressesLoading}
          error={addressesError}
          onRetry={refreshAddresses}
          onAdd={async (address) => (await addAddress(address)).error}
          onUpdate={updateAddress}
          onDelete={deleteAddress}
          onSetDefault={setDefaultAddress}
        />
      </div>
    </div>
  )
}
