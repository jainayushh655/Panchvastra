'use client'

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
        /*
         * A deliberate <img>, not next/image.
         *
         * `src` here is EITHER a backend URL or a local `blob:` preview produced by the
         * file input while the customer is choosing a new photo. The Next image optimizer
         * cannot fetch a `blob:` URL — it exists only in this tab — so routing this
         * through next/image would break the preview, which is the half of this component
         * that actually matters during an edit. The avatar is at most 80px and already
         * falls back to initials when the URL fails, so there is nothing to optimise.
         */
        // eslint-disable-next-line @next/next/no-img-element
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
