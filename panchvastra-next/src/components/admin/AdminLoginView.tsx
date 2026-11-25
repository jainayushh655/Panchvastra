'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout'
import { OtpAuthForm } from '@/components/auth/OtpAuthForm'
import { Button } from '@/components/ui/Button'
import { ADMIN_ROLE_ID } from '@/context/AuthProvider'
import { useAdminAuth } from '@/components/admin/AdminAuthProvider'
import { safeAdminNextPath } from '@/lib/nextPath'

/**
 * Admin sign-in — the SAME email -> OTP flow the storefront uses, then the role check.
 *
 * Ported from the Vite `src/admin/pages/AdminLoginPage.tsx`. The authentication path is
 * untouched: `POST /v1/login_user/` then `POST /v1/verify_email/` through the existing
 * `AuthProvider` and the existing `OtpAuthForm` — no password, no admin-only auth
 * endpoint, no second state machine, and no new DTO. The presentation is the shared
 * `AuthSplitLayout`, exactly as in Vite.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE ONE REAL ADDITION: THE SERVER HAS TO AGREE
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite version finished at the client-side role check — `user.roleId !==
 * ADMIN_ROLE_ID` meant denied, otherwise navigate to the dashboard. That is sufficient
 * when the guard is also client-side, which it was.
 *
 * Here it is not sufficient, and deliberately not trusted. After authentication this
 * screen asks the SERVER to verify the token (`syncCookie()` -> `POST
 * /admin/api/session` -> the backend's admin-only endpoint) and navigates only if the
 * backend confirms it. The client-side `roleId` check is kept, but purely as a fast path
 * that avoids a pointless round trip for an obvious non-admin — it can only ever deny,
 * never admit. A tampered `role_id` in storage gets a refusal from the server.
 *
 * The three outcomes are shown distinctly because they need different actions from the
 * person: refused means "wrong account", unavailable means "try again", and neither should
 * read as the other.
 *
 * ⚠️ A FAILED ADMIN LOGIN LEAVES NO ADMIN COOKIE. Every failing branch of the bridge
 * clears it server-side, and `logout()` clears it too — so a denial cannot leave a stale
 * cookie that the Edge proxy would wave through to a page that then has to refuse again.
 *
 * A DENIED PERSON IS NOT SIGNED OUT. They are an ordinary customer who visited `/admin`;
 * taking their shopping session away as a side effect would be hostile. That is the Vite
 * behaviour and it is preserved.
 */
export function AdminLoginView() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isSignedIn, isSessionLoaded, cookieState, syncCookie, logout } = useAdminAuth()

  const [denied, setDenied] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [checking, setChecking] = useState(false)

  /*
   * Where to go once the server agrees.
   *
   * `safeAdminNextPath` is what makes `?next=` safe to honour: it rejects another origin,
   * a protocol-relative `//host`, a `/\host`, control characters — and then narrows what
   * survives to the `/admin` area, so this screen cannot be used to bounce a
   * freshly-elevated session to an arbitrary internal path. Anything else becomes the
   * dashboard. See `lib/nextPath.ts`.
   */
  const destination = safeAdminNextPath(searchParams.get('next'))

  /**
   * Verify with the server, then navigate. The ONLY route into the admin area.
   *
   * `replace`, not `push`: the sign-in screen must not sit in the history behind the
   * dashboard, or Back would return to it with a live session.
   */
  const enterAdminArea = useCallback(async () => {
    setChecking(true)
    setDenied(false)
    setUnavailable(false)

    const state = await syncCookie({ force: true })

    setChecking(false)

    if (state === 'verified') {
      router.replace(destination)
      return
    }

    if (state === 'unavailable') {
      // The backend could not be reached. Not a permission problem — say so, and let them
      // retry rather than implying their account is wrong.
      setUnavailable(true)
      return
    }

    // 'refused' or anything else: the backend declined to perform an admin-only read.
    setDenied(true)
  }, [destination, router, syncCookie])

  /*
   * Someone arriving at the sign-in screen who ALREADY holds an admin session goes
   * straight through — but still only after the server confirms it. The Vite version
   * redirected on the client-side flag alone; this asks first.
   *
   * It runs once the stored session has been read (`isSessionLoaded`), so the effect does
   * not fire on the first render when `user` is null for everyone. `cookieState` is in the
   * condition so a session already verified in this tab is not re-verified on every
   * render — and `syncAdminSessionCookie`'s own latch covers the rest.
   */
  useEffect(() => {
    if (!isSessionLoaded || !isAuthenticated) return
    if (checking || denied || unavailable) return
    if (cookieState === 'syncing') return

    if (cookieState === 'verified') {
      router.replace(destination)
      return
    }

    void enterAdminArea()
  }, [
    checking,
    cookieState,
    denied,
    destination,
    enterAdminArea,
    isAuthenticated,
    isSessionLoaded,
    router,
    unavailable,
  ])

  const shell = (children: React.ReactNode) => (
    <AuthSplitLayout
      eyebrow="Panchvastra"
      headline={
        <>
          Admin
          <br />
          Access
        </>
      }
      tagline="Manage the Panchvastra storefront."
    >
      {children}
    </AuthSplitLayout>
  )

  /* ─────────────────── the backend could not be asked ─────────────────── */
  if (unavailable) {
    return shell(
      <div className="pv-auth-rise">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Panchvastra Admin</p>
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight text-black">Can&rsquo;t verify right now</h1>
        <p className="mt-3 text-sm text-zinc-600">
          We couldn&rsquo;t reach the server to confirm your admin access. Your sign-in worked — this is a
          connection problem, not a permission problem.
        </p>

        <div className="mt-7 space-y-3">
          <Button
            type="button"
            size="lg"
            className="w-full !border-black !bg-black !text-white hover:!bg-zinc-800"
            disabled={checking}
            onClick={() => void enterAdminArea()}
          >
            {checking ? 'Checking…' : 'Try again'}
          </Button>
          <Button type="button" size="lg" variant="outline" className="w-full" onClick={() => router.replace('/')}>
            Back to Panchvastra
          </Button>
        </div>
      </div>,
    )
  }

  /*
   * ─────────────────── authenticated, but not an admin ───────────────────
   *
   * Reached either because the client-side role check refused, or — the one that matters —
   * because the SERVER refused. `isSignedIn && !isAuthenticated` reproduces the Vite
   * condition for someone who was already signed in as a customer before arriving here.
   */
  if (denied || (isSessionLoaded && isSignedIn && !isAuthenticated)) {
    return shell(
      <div className="pv-auth-rise">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Panchvastra Admin</p>
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight text-black">Access denied</h1>
        <p className="mt-3 text-sm text-zinc-600">You do not have permission to access the admin panel.</p>
        <p className="mt-2 text-sm text-zinc-600">You are still signed in and can continue shopping as usual.</p>

        <div className="mt-7 space-y-3">
          <Button
            type="button"
            size="lg"
            className="w-full !border-black !bg-black !text-white hover:!bg-zinc-800"
            onClick={() => router.replace('/')}
          >
            Back to Panchvastra
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => {
              // Ends the shared session AND drops the admin cookie, so the next attempt
              // starts from nothing rather than from a refused state.
              logout()
              setDenied(false)
              setUnavailable(false)
            }}
          >
            Sign in with another account
          </Button>
        </div>
      </div>,
    )
  }

  /* ─────────────────── verifying with the server ─────────────────── */
  if (checking || cookieState === 'syncing') {
    return shell(
      <div className="pv-auth-rise" role="status" aria-live="polite">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Panchvastra Admin</p>
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight text-black">Verifying access</h1>
        <p className="mt-3 text-sm text-zinc-600">Confirming your admin permissions with the server…</p>
      </div>,
    )
  }

  /* ─────────────────── the ordinary sign-in form ─────────────────── */
  return shell(
    <OtpAuthForm
      idPrefix="admin"
      emailHeading="Admin Login"
      emailSubtitle="Sign in with your email to manage the storefront."
      onAuthenticated={(user) => {
        /*
         * Authenticated. Now authorize — and the server has the last word.
         *
         * The client-side role check stays as a fast path: a user the backend has already
         * told us is not an admin is refused here without a round trip. It can only deny.
         * Anything that passes it still has to survive `enterAdminArea()`.
         */
        if (user.roleId !== ADMIN_ROLE_ID) {
          setDenied(true)
          return
        }

        void enterAdminArea()
      }}
    />,
  )
}
