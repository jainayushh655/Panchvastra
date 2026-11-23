'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { DEFAULT_NEXT_PATH, safeNextPath } from '@/lib/nextPath'

/**
 * The link between the sign-in and sign-up screens, carrying the return path with it.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY IT IS NOT A PLAIN `<Link>`
 * ──────────────────────────────────────────────────────────────────────────────
 * The guard sends a signed-out customer to `/login?next=/cart`. If they decide they need
 * an account first and follow the plain "Create account" link, that `next` is dropped —
 * so after signing up they land on the homepage instead of the cart they were trying to
 * reach. The Vite app has exactly that gap (its sign-up screen always goes home), and it
 * is invisible until someone actually takes that route.
 *
 * Forwarding the parameter closes it, and costs nothing: the two screens now agree about
 * where the customer was going, whichever one they finish on.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * TWO THINGS THIS IS CAREFUL ABOUT
 * ──────────────────────────────────────────────────────────────────────────────
 * 1. IT VALIDATES BEFORE FORWARDING. `safeNextPath` runs here, not just at the
 *    destination, so a hostile value is dropped at the first hop rather than being copied
 *    from one URL into another. An unsafe or absent value simply yields the bare link.
 *
 * 2. IT READS THE PARAMETER AFTER MOUNT, not through `useSearchParams()`. That hook makes
 *    a statically-rendered route bail out to client rendering, and these two screens are
 *    prerendered. The first render emits the bare `href` — which is what the server
 *    renders too, so hydration matches — and the effect then upgrades it. A customer who
 *    clicks before hydration gets the bare link, which is the current behaviour anyway.
 */
export function AuthSwitchLink({
  href,
  className,
  children,
}: {
  /** The destination path, with no query of its own. */
  href: string
  className?: string
  children: ReactNode
}) {
  const [target, setTarget] = useState(href)

  useEffect(() => {
    const requested = safeNextPath(new URLSearchParams(window.location.search).get('next'))
    if (requested === DEFAULT_NEXT_PATH) return
    setTarget(`${href}?next=${encodeURIComponent(requested)}`)
  }, [href])

  return (
    <Link href={target} className={className}>
      {children}
    </Link>
  )
}
