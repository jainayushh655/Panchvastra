import { AdminBreadcrumb } from '@/components/admin/AdminBreadcrumb'
import { ADMIN_NAV } from '@/lib/adminNav'
import { requireAdmin } from '@/lib/adminSession.server'

/**
 * `/admin/dashboard` — the landing page, and for now a deliberate placeholder.
 *
 * It exists to prove the shell: that the Edge proxy lets an authorized request through,
 * that `(protected)/layout.tsx` verified the session with the backend before any of this
 * rendered, that `admin.css` is applied, and that the sidebar, topbar and breadcrumb work.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT IT DELIBERATELY DOES NOT DO
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite `AdminDashboardPage` renders counts and recent activity from the catalogue and
 * order endpoints. None of that is reproduced here, and no number on this page is
 * invented: a dashboard showing fabricated or placeholder metrics is worse than a
 * dashboard showing none, because it looks authoritative. Dashboard metrics are a later
 * phase, and this page says so in as many words.
 *
 * It is a Server Component with no client JavaScript of its own, and it makes no API
 * request — the only backend call behind this URL is the authorization check in the
 * layout above.
 */

/** What is already migrated, named rather than described, so the list cannot drift. */
const DONE = [
  'Server-verified admin authorization on every protected request',
  'httpOnly admin session cookie, scoped to /admin',
  'Admin sign-in through the existing email + OTP flow',
  'Admin shell: sidebar, topbar, breadcrumbs and mobile navigation',
  'Shared table, state and confirmation primitives for the screens to come',
]

export default async function AdminDashboardPage() {
  /*
   * ⚠️ FIRST, before anything else is computed or fetched.
   *
   * The layout above also guards this route, but a layout and its page render
   * CONCURRENTLY — so without this the page's output is still produced and still ends up
   * in the RSC payload inlined in the body of the redirect that refused the request.
   * Measured during Phase 5B: a forged cookie got a 307 whose body carried this whole
   * page. See `requireAdmin` for the full account. Every protected admin page added later
   * must do the same, ahead of any data fetch.
   */
  await requireAdmin()

  const pending = ADMIN_NAV.filter((item) => !item.ready)

  return (
    <>
      {/*
        The header block is the Vite admin convention exactly — `admin-page__header` with
        an eyebrow and a heading on the left and the breadcrumb on the right — so it
        matches the eleven screens that arrive later without them having to restyle it.
        The one change is `<h2>` becoming `<h1>`: this is the page's only heading, and the
        Phase 4F-5 sweep asserts exactly one `h1` per route.
      */}
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Overview</p>
          <h1>Dashboard</h1>
        </div>
        <AdminBreadcrumb items={[{ label: 'Admin' }, { label: 'Dashboard' }]} />
      </div>

      <div className="admin-state">
        <h3>Metrics arrive in a later phase</h3>
        <p>
          This is the admin shell, not the finished dashboard. Order counts, revenue and recent activity are
          migrated with the management screens — nothing on this page is a placeholder number, because a
          fabricated metric is worse than none.
        </p>
      </div>

      <section className="admin-card" aria-labelledby="admin-ready-heading">
        <h2 id="admin-ready-heading" className="admin-card__title">
          Working now
        </h2>
        <ul className="admin-list">
          {DONE.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="admin-card" aria-labelledby="admin-pending-heading">
        <h2 id="admin-pending-heading" className="admin-card__title">
          Screens still to migrate ({pending.length})
        </h2>
        <p className="admin-card__hint">
          These appear in the sidebar as unavailable rather than as links, so nothing there leads to a dead
          route.
        </p>
        <ul className="admin-list">
          {pending.map((item) => (
            <li key={item.href}>{item.label}</li>
          ))}
        </ul>
      </section>
    </>
  )
}
