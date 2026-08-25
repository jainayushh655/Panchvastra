import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ProfileAvatar } from '@/components/profile/ProfileAvatar'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { GENDER_OPTIONS, type ProfileInfo } from '@/lib/mockProfile'

type ProfileInfoSectionProps = {
  profile: ProfileInfo
  loading: boolean
  /** Set when the profile itself failed to load. */
  error: string | null
  onRetry: () => void
  /** Persists the profile; resolves to an error message, or null once the save succeeded. */
  onSave: (next: ProfileInfo, imageFile: File | null) => Promise<string | null>
}

function formatDob(value: string): string {
  if (!value) return 'Not added'
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return 'Not added'
  return `${d} / ${m} / ${y}`
}

function genderLabel(value: ProfileInfo['gender']): string {
  if (!value) return 'Not added'
  return GENDER_OPTIONS.find((g) => g.value === value)?.label ?? 'Not added'
}

function ViewField({ label, value }: { label: string; value: string }) {
  const isEmpty = value === 'Not added'
  return (
    <div>
      <p className="type-label">{label}</p>
      <p className={`mt-1.5 text-sm ${isEmpty ? 'text-zinc-400 dark:text-zinc-500' : 'text-black dark:text-white'}`}>
        {value}
      </p>
    </div>
  )
}

export function ProfileInfoSection({ profile, loading, error, onRetry, onSave }: ProfileInfoSectionProps) {
  const [editing, setEditing] = useState(false)

  /** Closes the form only once the backend confirmed the update. */
  const handleSave = async (next: ProfileInfo, imageFile: File | null) => {
    const failure = await onSave(next, imageFile)
    if (failure) return failure
    setEditing(false)
    return null
  }

  return (
    <section className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-4">
        <h2 className="type-section-title">Personal Information</h2>
        {!editing && !loading && !error ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit Profile
          </Button>
        ) : null}
      </div>

      <div className="mt-6">
        {loading ? (
          <div
            className="border border-zinc-200 px-6 py-12 text-center dark:border-zinc-800"
            role="status"
            aria-live="polite"
          >
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading profile…</p>
          </div>
        ) : error ? (
          <div className="border border-zinc-200 px-6 py-12 text-center dark:border-zinc-800" role="alert">
            <p className="font-semibold text-black dark:text-white">Unable to load profile.</p>
            <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{error}</p>
            <Button className="mt-6" onClick={onRetry}>
              Try Again
            </Button>
          </div>
        ) : editing ? (
          <ProfileForm profile={profile} onSave={handleSave} onCancel={() => setEditing(false)} />
        ) : (
          <>
            <div className="flex items-center gap-5">
              <ProfileAvatar
                src={profile.profileImageUrl}
                firstName={profile.firstName}
                lastName={profile.lastName}
                email={profile.email}
              />
              <div className="min-w-0">
                <p className="truncate font-sans text-base font-semibold text-black dark:text-white">
                  {[profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Your profile'}
                </p>
                <p className="mt-0.5 truncate text-sm text-zinc-500 dark:text-zinc-400">{profile.email}</p>
              </div>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <ViewField label="First Name" value={profile.firstName || 'Not added'} />
              <ViewField label="Last Name" value={profile.lastName || 'Not added'} />
              <ViewField label="Email" value={profile.email || 'Not added'} />
              <ViewField label="Mobile" value={profile.mobile || 'Not added'} />
              <ViewField label="Gender" value={genderLabel(profile.gender)} />
              <ViewField label="Date of Birth" value={formatDob(profile.dateOfBirth)} />
            </div>
          </>
        )}
      </div>
    </section>
  )
}
