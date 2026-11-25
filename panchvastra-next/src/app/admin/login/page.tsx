import { Suspense } from 'react'
import { AuthSplitLayout } from '@/components/auth/AuthSplitLayout'
import { AdminLoginView } from '@/components/admin/AdminLoginView'

/**
 * `/admin/login` — deliberately OUTSIDE the `(protected)` group, so it is reachable with
 * no admin cookie. Guarding the sign-in screen would be a redirect loop, and `src/proxy.ts`
 * exempts this path for the same reason.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THE SUSPENSE BOUNDARY, AND WHY ITS FALLBACK IS NOT `null`
 * ──────────────────────────────────────────────────────────────────────────────
 * The boundary is required: `AdminLoginView` reads `?next=` through `useSearchParams()`,
 * and Next fails the build without one ("useSearchParams() should be wrapped in a suspense
 * boundary").
 *
 * The first version used `fallback={null}`, and that was a mistake worth recording — it
 * left the page's SERVER-RENDERED HTML completely empty. The screen worked, because the
 * client took over immediately, but anyone reaching it on a slow connection got a blank
 * page first, and nothing identified the page before JavaScript ran.
 *
 * So the fallback is the real brand frame — the same `AuthSplitLayout` the view itself
 * renders into. The panel, the headline and the tagline are in the HTML from the first
 * byte; only the form swaps in. Because both sides use the same shell, that swap is not a
 * visible jump.
 */
export default function AdminLoginPage() {
  return (
    <Suspense
      fallback={
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
          <div className="pv-auth-rise" role="status" aria-live="polite">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Panchvastra Admin</p>
            <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight text-black">Admin Login</h1>
            <p className="mt-3 text-sm text-zinc-600">Loading the sign-in form…</p>
          </div>
        </AuthSplitLayout>
      }
    >
      <AdminLoginView />
    </Suspense>
  )
}
