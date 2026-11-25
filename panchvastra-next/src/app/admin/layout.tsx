import type { Metadata } from 'next'
import { AdminAuthProvider } from '@/components/admin/AdminAuthProvider'
import { internalPageMetadata } from '@/lib/metadata'
import './admin.css'

/**
 * The outermost admin layout — styles and the session provider, and NO guard.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THE GUARD IS NOT HERE
 * ──────────────────────────────────────────────────────────────────────────────
 * This layout wraps EVERYTHING under `/admin`, including `/admin/login`. Putting the
 * authorization check here would mean the sign-in screen itself required an admin
 * session — an unbreakable redirect loop, and the same for the `/admin/api/session`
 * bridge that is the only way to obtain one.
 *
 * So the check lives one level down, in `app/admin/(protected)/layout.tsx`. A route group
 * in parentheses does not appear in the URL, so `(protected)/dashboard` still serves
 * `/admin/dashboard` — the split is purely about what gets guarded.
 *
 *     /admin/login          -> this layout only            (unguarded, by design)
 *     /admin/api/session    -> Route Handler, own checks   (unguarded, by design)
 *     /admin/dashboard      -> this + (protected)/layout   (server-verified)
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY `admin.css` IS IMPORTED HERE AND NOWHERE ELSE
 * ──────────────────────────────────────────────────────────────────────────────
 * It is 1,299 lines copied byte-for-byte from the Vite `src/admin/styles/admin.css`, and
 * it defines `--admin-*` custom properties on `:root`. Importing it in this layout means
 * Next only serves it on `/admin` routes, so no shopper page downloads it and nothing in
 * it can affect storefront styling — the isolation the Phase 3 notes asked for
 * (`providers.tsx`: "it belongs in app/admin/layout.tsx so the admin CSS and its provider
 * never load for a shopper"). That is asserted by a test, not assumed.
 *
 * `AdminAuthProvider` is mounted here rather than in the root `providers.tsx` for the same
 * reason: a shopper must not download or run it.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * NOINDEX, UNCONDITIONALLY
 * ──────────────────────────────────────────────────────────────────────────────
 * `internalPageMetadata` emits `noindex, nofollow, nocache`, the same treatment
 * `/migration-status` gets, and it is NOT part of the Phase 2 migration-wide block that
 * Phase 7 lifts. An admin panel must never be indexed at any point in this project.
 */

export const metadata: Metadata = internalPageMetadata('Admin')

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>
}
