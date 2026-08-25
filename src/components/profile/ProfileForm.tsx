import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { ProfileAvatar } from '@/components/profile/ProfileAvatar'
import { validateDateOfBirth, validatePhoneIndia } from '@/lib/formValidation'
import { GENDER_OPTIONS, type ProfileInfo } from '@/lib/mockProfile'

type ProfileFormProps = {
  profile: ProfileInfo
  /** Persists the profile; resolves to an error message, or null once the save succeeded. */
  onSave: (next: ProfileInfo, imageFile: File | null) => Promise<string | null>
  onCancel: () => void
}

type FieldErrors = Partial<Record<'firstName' | 'lastName' | 'mobile' | 'dateOfBirth' | 'image', string>>

/** Mirrors the maxLength values in the backend's `UpdateUserProfileRequest` schema. */
const NAME_MAX_LENGTH = 100
const MOBILE_MAX_LENGTH = 20
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

const inputCls =
  'w-full border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition-colors focus:border-black dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-white'

export function ProfileForm({ profile, onSave, onCancel }: ProfileFormProps) {
  const [draft, setDraft] = useState<ProfileInfo>(profile)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  /** Synchronous guard — state updates are not immediate, so a double click could double-submit. */
  const inFlight = useRef(false)

  // Releases the object URL created for the local preview.
  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    event.target.value = ''
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, image: 'Choose an image file.' }))
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setErrors((prev) => ({ ...prev, image: 'Image must be 5 MB or smaller.' }))
      return
    }

    setErrors((prev) => ({ ...prev, image: undefined }))
    setImageFile(file)
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return URL.createObjectURL(file)
    })
  }

  const clearSelectedImage = () => {
    setImageFile(null)
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return null
    })
    setErrors((prev) => ({ ...prev, image: undefined }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current) return

    const nextErrors: FieldErrors = {}
    const firstName = draft.firstName.trim()
    if (!firstName) nextErrors.firstName = 'First name is required.'
    if (draft.mobile.trim()) {
      const mobileErr = validatePhoneIndia(draft.mobile)
      if (mobileErr) nextErrors.mobile = mobileErr
    }
    const dobErr = validateDateOfBirth(draft.dateOfBirth)
    if (dobErr) nextErrors.dateOfBirth = dobErr

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    inFlight.current = true
    setSaving(true)
    setSubmitError(null)

    const failure = await onSave(draft, imageFile)

    inFlight.current = false
    setSaving(false)
    // On failure the caller keeps the form open, so the entered values survive.
    if (failure) setSubmitError(failure)
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      <div className="flex items-center gap-5 sm:col-span-2">
        <ProfileAvatar
          src={previewUrl ?? draft.profileImageUrl}
          firstName={draft.firstName}
          lastName={draft.lastName}
          email={draft.email}
          size="lg"
        />
        <div className="min-w-0">
          <p className="type-label">Profile Photo</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <label
              className={`cursor-pointer border border-zinc-300 px-3.5 py-2 font-sans text-xs font-bold uppercase tracking-wide text-black transition-colors hover:border-black dark:border-zinc-700 dark:text-white dark:hover:border-white ${
                saving ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              {imageFile ? 'Change Photo' : 'Upload Photo'}
              <input type="file" accept="image/*" className="sr-only" disabled={saving} onChange={handleImageChange} />
            </label>
            {imageFile ? (
              <button
                type="button"
                onClick={clearSelectedImage}
                disabled={saving}
                className="font-sans text-xs font-bold uppercase tracking-wide text-zinc-500 underline underline-offset-2 transition-colors hover:text-black dark:hover:text-white"
              >
                Undo
              </button>
            ) : null}
          </div>
          {imageFile ? (
            <p className="mt-2 truncate text-xs text-zinc-500 dark:text-zinc-400">{imageFile.name}</p>
          ) : (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">JPG or PNG, up to 5 MB.</p>
          )}
          {errors.image ? <p className="mt-1.5 text-xs text-red-600">{errors.image}</p> : null}
        </div>
      </div>

      <div>
        <label htmlFor="profile-first-name" className="type-label">
          First Name
        </label>
        <input
          id="profile-first-name"
          type="text"
          value={draft.firstName}
          maxLength={NAME_MAX_LENGTH}
          onChange={(e) => {
            setDraft({ ...draft, firstName: e.target.value })
            setErrors((prev) => ({ ...prev, firstName: undefined }))
          }}
          className={`mt-1.5 ${inputCls}`}
          placeholder="First name"
        />
        {errors.firstName ? <p className="mt-1.5 text-xs text-red-600">{errors.firstName}</p> : null}
      </div>

      <div>
        <label htmlFor="profile-last-name" className="type-label">
          Last Name
        </label>
        <input
          id="profile-last-name"
          type="text"
          value={draft.lastName}
          maxLength={NAME_MAX_LENGTH}
          onChange={(e) => {
            setDraft({ ...draft, lastName: e.target.value })
            setErrors((prev) => ({ ...prev, lastName: undefined }))
          }}
          className={`mt-1.5 ${inputCls}`}
          placeholder="Last name"
        />
        {errors.lastName ? <p className="mt-1.5 text-xs text-red-600">{errors.lastName}</p> : null}
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
          readOnly
          className={`mt-1.5 ${inputCls} cursor-not-allowed bg-zinc-100 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-500`}
        />
        <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">Your registered email can't be changed here.</p>
      </div>

      <div>
        <label htmlFor="profile-mobile" className="type-label">
          Mobile
        </label>
        <input
          id="profile-mobile"
          type="tel"
          value={draft.mobile}
          maxLength={MOBILE_MAX_LENGTH}
          onChange={(e) => {
            setDraft({ ...draft, mobile: e.target.value })
            setErrors((prev) => ({ ...prev, mobile: undefined }))
          }}
          className={`mt-1.5 ${inputCls}`}
          placeholder="+91 XXXXX XXXXX"
        />
        {errors.mobile ? <p className="mt-1.5 text-xs text-red-600">{errors.mobile}</p> : null}
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

      {submitError ? (
        <p className="text-sm text-red-600 dark:text-red-400 sm:col-span-2" role="alert">
          {submitError}
        </p>
      ) : null}

      <div className="flex gap-3 sm:col-span-2 sm:justify-end">
        <Button type="button" variant="ghostLight" onClick={onCancel} disabled={saving} className="border-zinc-300">
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
