'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthProvider'

/**
 * The customer-area route guard.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT IT REPLACES
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite app wraps `/cart`, `/checkout`, `/profile`, `/orders` and `/wishlist` in a
 * `<ProtectedRoute />` route element that redirects a signed-out visitor to `/login`,
 * carrying where they came from:
 *
 *     <Navigate to="/login" replace state={{ from: pathname + search }} />
 *
 * This is the same guard, with the return path travelling as `?next=` — the convention
 * Phase 4B established on the product page, because the App Router has no equivalent of
 * react-router's `location.state`. Phase 4D's login page reads it.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY IT IS A CLIENT COMPONENT AND NOT MIDDLEWARE
 * ──────────────────────────────────────────────────────────────────────────────
 * Middleware would be the better place for this, and it is where it ends up — but it
 * needs a credential the SERVER can read, and today the JWT lives in `localStorage`
 * (Phase 2's recorded decision; Phase 5 mirrors it into an httpOnly cookie). Until then
 * the only place the session exists is the browser, so the only place it can be checked
 * is the browser. That is exactly as true of the Vite app, so nothing is lost here.
 *
 * ⚠️ THIS IS NOT ACCESS CONTROL, and must never be mistaken for it. It hides a page; it
 * does not protect data. Every authenticated read behind these pages is enforced by the
 * backend against the bearer token, which is the only check that counts. Phase 5's
 * middleware does not change that either.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY IT WAITS FOR `isSessionLoaded`
 * ──────────────────────────────────────────────────────────────────────────────
 * `AuthProvider` restores the session in an effect after mount, so for the first render
 * `user` is null for EVERYONE — signed in or not. Redirecting on that would bounce every
 * signed-in shopper to the login screen on every visit to their own cart. `isSessionLoaded`
 * (added in Phase 3 for precisely this) is what separates "signed out" from "not read
 * yet".
 *
 * While it is unknown this renders `fallback`, which the server renders too — so the
 * server HTML and the first client render agree and hydration is clean.
 */
export function ProtectedRoute({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const { isAuthenticated, isSessionLoaded, isSigningOut } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isSessionLoaded || isAuthenticated) return

    /*
     * A deliberate sign-out is already going somewhere — the homepage — so this must not
     * redirect on top of it.
     *
     * Measured, not theorised: without this, logging out from `/profile` landed the
     * customer on `/login?next=%2Fprofile`, because the guard's redirect ran after the
     * handler's own navigation. The Vite app sends them home. The page's children are
     * still withheld below, so suppressing the redirect reveals nothing.
     */
    if (isSigningOut) return

    /*
     * The return path is read from `window.location`, not from `usePathname` /
     * `useSearchParams`, and that is a deliberate choice rather than a shortcut.
     *
     * `useSearchParams()` makes the client tree up to the nearest Suspense boundary
     * client-rendered on a statically prerendered route — and it does not merely warn,
     * it FAILS the build: "useSearchParams() should be wrapped in a suspense boundary at
     * page /cart". Wrapping each guarded page in a Suspense boundary would work, but it
     * would buy nothing: this value is only ever needed inside this effect, effects run
     * only in the browser, and `window.location` is exactly the same string
     * (`pathname + search`) the Vite guard passes. Reading it here keeps the guarded
     * pages prerenderable as their signed-out shell.
     */
    const here = `${window.location.pathname}${window.location.search}`
    // `replace`, like the Vite `<Navigate replace>`: the guarded page must not sit in the
    // history behind the login screen, or Back would bounce the shopper straight out again.
    router.replace(`/login?next=${encodeURIComponent(here)}`)
  }, [isAuthenticated, isSessionLoaded, isSigningOut, router])

  if (!isSessionLoaded || !isAuthenticated) {
    return <>{fallback ?? null}</>
  }

  return <>{children}</>
}
