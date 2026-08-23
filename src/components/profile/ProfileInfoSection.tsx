import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ProfileForm } from '@/components/profile/ProfileForm'
import { GENDER_OPTIONS, type ProfileInfo } from '@/lib/mockProfile'

type ProfileInfoSectionProps = {
  profile: ProfileInfo
  onSave: (next: ProfileInfo) => void
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

export function ProfileInfoSection({ profile, onSave }: ProfileInfoSectionProps) {
  const [editing, setEditing] = useState(false)

  const handleSave = (next: ProfileInfo) => {
    onSave(next)
    setEditing(false)
  }

  return (
    <section className="border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-center justify-between gap-4">
        <h2 className="type-section-title">Personal Information</h2>
        {!editing ? (
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit Profile
          </Button>
        ) : null}
      </div>

      <div className="mt-6">
        {editing ? (
          <ProfileForm profile={profile} onSave={handleSave} onCancel={() => setEditing(false)} />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            <ViewField label="Full Name" value={profile.fullName || 'Not added'} />
            <ViewField label="Email" value={profile.email || 'Not added'} />
            <ViewField label="Phone" value={profile.phone || 'Not added'} />
            <ViewField label="Gender" value={genderLabel(profile.gender)} />
            <ViewField label="Date of Birth" value={formatDob(profile.dateOfBirth)} />
          </div>
        )}
      </div>
    </section>
  )
}
