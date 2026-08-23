import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { validateDateOfBirth, validateFullName, validatePhoneIndia } from '@/lib/formValidation'
import { GENDER_OPTIONS, type ProfileInfo } from '@/lib/mockProfile'

type ProfileFormProps = {
  profile: ProfileInfo
  onSave: (next: ProfileInfo) => void
  onCancel: () => void
}

type FieldErrors = Partial<Record<'fullName' | 'phone' | 'dateOfBirth', string>>

const inputCls =
  'w-full border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition-colors focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-white'

export function ProfileForm({ profile, onSave, onCancel }: ProfileFormProps) {
  const [draft, setDraft] = useState<ProfileInfo>(profile)
  const [errors, setErrors] = useState<FieldErrors>({})

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    const nextErrors: FieldErrors = {}
    const nameErr = validateFullName(draft.fullName)
    if (nameErr) nextErrors.fullName = nameErr
    if (draft.phone.trim()) {
      const phoneErr = validatePhoneIndia(draft.phone)
      if (phoneErr) nextErrors.phone = phoneErr
    }
    const dobErr = validateDateOfBirth(draft.dateOfBirth)
    if (dobErr) nextErrors.dateOfBirth = dobErr

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    onSave(draft)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="profile-full-name" className="type-label">
          Full Name
        </label>
        <input
          id="profile-full-name"
          type="text"
          value={draft.fullName}
          onChange={(e) => {
            setDraft({ ...draft, fullName: e.target.value })
            setErrors((prev) => ({ ...prev, fullName: undefined }))
          }}
          className={`mt-1.5 ${inputCls}`}
          placeholder="Your full name"
        />
        {errors.fullName ? <p className="mt-1.5 text-xs text-red-600">{errors.fullName}</p> : null}
      </div>

      <div>
        <label htmlFor="profile-email" className="type-label">
          Email
        </label>
        <input
          id="profile-email"
          type="email"
          value={draft.email}
          disabled
          className={`mt-1.5 ${inputCls} cursor-not-allowed bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500`}
        />
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">Your registered email can't be changed here.</p>
      </div>

      <div>
        <label htmlFor="profile-phone" className="type-label">
          Phone
        </label>
        <input
          id="profile-phone"
          type="tel"
          value={draft.phone}
          onChange={(e) => {
            setDraft({ ...draft, phone: e.target.value })
            setErrors((prev) => ({ ...prev, phone: undefined }))
          }}
          className={`mt-1.5 ${inputCls}`}
          placeholder="+91 XXXXX XXXXX"
        />
        {errors.phone ? <p className="mt-1.5 text-xs text-red-600">{errors.phone}</p> : null}
      </div>

      <div>
        <label htmlFor="profile-gender" className="type-label">
          Gender
        </label>
        <select
          id="profile-gender"
          value={draft.gender ?? ''}
          onChange={(e) => setDraft({ ...draft, gender: (e.target.value || null) as ProfileInfo['gender'] })}
          className={`mt-1.5 ${inputCls} cursor-pointer`}
        >
          <option value="">Select Gender</option>
          {GENDER_OPTIONS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="profile-dob" className="type-label">
          Date of Birth
        </label>
        <input
          id="profile-dob"
          type="date"
          value={draft.dateOfBirth}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => {
            setDraft({ ...draft, dateOfBirth: e.target.value })
            setErrors((prev) => ({ ...prev, dateOfBirth: undefined }))
          }}
          className={`mt-1.5 ${inputCls}`}
        />
        {errors.dateOfBirth ? <p className="mt-1.5 text-xs text-red-600">{errors.dateOfBirth}</p> : null}
      </div>

      <div className="flex gap-3 sm:col-span-2 sm:justify-end">
        <Button type="button" variant="ghostLight" onClick={onCancel} className="border-zinc-300">
          Cancel
        </Button>
        <Button type="submit">Save Changes</Button>
      </div>
    </form>
  )
}
