import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ProfileInfoSection } from '@/components/profile/ProfileInfoSection'
import { AddressSection } from '@/components/profile/AddressSection'
import { useAddresses } from '@/context/AddressProvider'
import { useAuth } from '@/context/AuthProvider'
import { useCart } from '@/context/CartProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import type { ProfileInfo } from '@/lib/mockProfile'

export function ProfilePage() {
  useDocumentTitle('My Profile')
  const { user, logout } = useAuth()
  const { clear } = useCart()
  const navigate = useNavigate()

  const [profile, setProfile] = useState<ProfileInfo>(() => ({
    fullName: user?.name ?? '',
    email: user?.email ?? '',
    phone: '',
    gender: null,
    dateOfBirth: '',
  }))

  // Shared with Checkout's delivery-address selection — see AddressProvider.
  const { addresses, addAddress, updateAddress, deleteAddress, setDefaultAddress } = useAddresses()

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
        Welcome back{profile.fullName ? `, ${profile.fullName}` : ''}
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_18rem]">
        <ProfileInfoSection profile={profile} onSave={setProfile} />

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
          onAdd={addAddress}
          onUpdate={updateAddress}
          onDelete={deleteAddress}
          onSetDefault={setDefaultAddress}
        />
      </div>
    </div>
  )
}
