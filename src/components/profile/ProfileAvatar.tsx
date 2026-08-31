import { useEffect, useState } from 'react'

type ProfileAvatarProps = {
  /** Image URL from the backend, a local preview URL, or '' when there is none. */
  src: string
  firstName: string
  lastName: string
  email: string
  size?: 'md' | 'lg'
}

const SIZE_CLASSES: Record<'md' | 'lg', string> = {
  md: 'h-16 w-16 text-lg',
  lg: 'h-20 w-20 text-xl',
}

function initials(firstName: string, lastName: string, email: string): string {
  const first = firstName.trim().charAt(0)
  const last = lastName.trim().charAt(0)
  const combined = `${first}${last}`.trim()
  if (combined) return combined.toUpperCase()
  return (email.trim().charAt(0) || 'A').toUpperCase()
}

/**
 * Profile photo with a monochrome initials fallback. A missing, empty or broken image URL
 * falls back to the initials rather than rendering a broken-image icon.
 */
export function ProfileAvatar({ src, firstName, lastName, email, size = 'md' }: ProfileAvatarProps) {
  const [failed, setFailed] = useState(false)

  // A new URL deserves a fresh attempt, even if the previous one failed to load.
  useEffect(() => {
    setFailed(false)
  }, [src])

  const showImage = Boolean(src.trim()) && !failed

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 ${SIZE_CLASSES[size]}`}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="font-sans font-bold tracking-wide text-zinc-500 dark:text-zinc-400">
          {initials(firstName, lastName, email)}
        </span>
      )}
    </div>
  )
}
