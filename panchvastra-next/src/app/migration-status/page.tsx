import Link from 'next/link'
import type { Metadata } from 'next'
import { envReadiness } from '@/lib/env'
import { serverEnvReadiness } from '@/lib/env.server'
import { internalPageMetadata } from '@/lib/metadata'
import { canReadOnServer } from '@/services/server/serverApi'

/**
 * Internal development status page — a Server Component.
 *
 * Shows where the migration stands and whether this environment is configured. It makes
 * NO network request: nothing here calls the Django API, so opening this page cannot
 * touch production. That is deliberate and should stay true — it is the one page safe to
 * open on any deployment.
 *
 * It reports environment variables as CONFIGURED / NOT SET booleans and never prints a
 * value. An API origin or a Google client ID in a screenshot is not a catastrophe, but
 * there is no reason to put them on a page either.
 *
 * Marked `noindex, nofollow, nocache` regardless of what Phase 7 decides for the rest of
 * the site.
 */

export const metadata: Metadata = internalPageMetadata('Migration status')

type PhaseState = 'done' | 'current' | 'planned'

const PHASES: { phase: string; title: string; detail: string; state: PhaseState }[] = [
  {
    phase: 'Phase 1',
    title: 'Migration audit',
    detail: 'Routes, API inventory, risks and the phase plan.',
    state: 'done',
  },
  {
    phase: 'Phase 2',
    title: 'Next.js foundation',
    detail: 'App Router, theme, assets, API layer, boundaries, metadata defaults.',
    state: 'done',
  },
  {
    phase: 'Phase 3',
    title: 'Shared components and layouts',
    detail: 'Storefront layout, navbar, footer, and the toast, auth, cart and wishlist providers.',
    state: 'done',
  },
  {
    phase: 'Phase 4A',
    title: 'Homepage',
    detail: 'Hero carousel, new arrivals, category tiles, category filter and the custom studio banner — server-rendered.',
    state: 'done',
  },
  {
    phase: 'Phase 4B',
    title: 'Shop and product detail',
    detail:
      'Server-rendered catalogue with filters, sorting and infinite scroll; product detail with variants, sizes, size charts, Notify Me and Product structured data.',
    state: 'done',
  },
  {
    phase: 'Phase 4C',
    title: 'Cart and wishlist',
    detail:
      'Server cart with quantity, removal and move-to-wishlist; per-account saved items; the customer-area route guard.',
    state: 'done',
  },
  {
    phase: 'Phase 4D',
    title: 'Remaining customer pages',
    detail: 'Auth, checkout, orders, profile, custom piece, help desk and the policy pages.',
    state: 'current',
  },
  {
    phase: 'Phase 5',
    title: 'Admin panel',
    detail: 'All thirteen admin screens, plus the httpOnly cookie bridge.',
    state: 'planned',
  },
  {
    phase: 'Phase 6',
    title: 'API integration and regression testing',
    detail: 'Server-side reads, caching, image hosts, full regression matrix.',
    state: 'planned',
  },
  {
    phase: 'Phase 7',
    title: 'SEO and deployment',
    detail: 'Per-route metadata, JSON-LD, sitemap, robots, production cutover.',
    state: 'planned',
  },
]

const STATE_STYLES: Record<PhaseState, { label: string; className: string }> = {
  done: { label: 'Complete', className: 'border-chocolate bg-chocolate text-cream' },
  current: { label: 'Next', className: 'border-burgundy bg-burgundy text-cream' },
  planned: { label: 'Planned', className: 'border-sand bg-transparent text-zinc-500' },
}

export default function MigrationStatusPage() {
  // Public (browser-visible) variables, then the server-only ones. Both report presence
  // only — this page is a Server Component, so reading the server list here is safe.
  const readiness = [...envReadiness(), ...serverEnvReadiness()]

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="type-eyebrow">Internal · not indexed</p>
      <h1 className="type-page-title mt-2">Migration status</h1>
      <p className="type-body mt-3">
        Development status for the Next.js migration of the PANCHVASTRA storefront. This
        page makes no API requests.
      </p>

      {/* ------------------------------------------------------------ phases */}
      <section className="mt-10" aria-labelledby="phases-heading">
        <h2 id="phases-heading" className="type-section-title">
          Phases
        </h2>

        <ol className="mt-4 divide-y divide-zinc-200 border border-zinc-200 bg-white">
          {PHASES.map((item) => {
            const style = STATE_STYLES[item.state]
            return (
              <li key={item.phase} className="flex items-start gap-4 px-5 py-4">
                <span
                  className={`mt-0.5 inline-flex shrink-0 items-center justify-center rounded-md border px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.14em] ${style.className}`}
                >
                  {style.label}
                </span>
                <div className="min-w-0">
                  <p className="font-sans text-sm font-semibold text-black">
                    {item.phase} — {item.title}
                  </p>
                  <p className="type-body-sm mt-1">{item.detail}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {/* ------------------------------------------------- environment readiness */}
      <section className="mt-12" aria-labelledby="env-heading">
        <h2 id="env-heading" className="type-section-title">
          Environment
        </h2>
        <p className="type-body-sm mt-2">
          Presence only — no values are displayed. An unset variable is not an error in
          Phase 2: the API base URL defaults to a same-origin relative path, which is what
          lets the build run with no backend reachable.
        </p>

        <ul className="mt-4 divide-y divide-zinc-200 border border-zinc-200 bg-white">
          {readiness.map((variable) => (
            <li
              key={variable.name}
              className="flex flex-wrap items-center justify-between gap-2 px-5 py-3"
            >
              <code className="font-sans text-xs font-semibold text-black">{variable.name}</code>
              <span className="flex items-center gap-3">
                <span className="type-body-sm">needed by {variable.required}</span>
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-[0.14em] ${
                    variable.configured
                      ? 'border-chocolate bg-chocolate text-cream'
                      : 'border-sand text-zinc-500'
                  }`}
                >
                  {variable.configured ? 'Configured' : 'Not set'}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <p className="type-body-sm mt-4">
          Server-side catalogue reads are{' '}
          <strong className="font-semibold text-black">
            {canReadOnServer() ? 'available' : 'unavailable'}
          </strong>{' '}
          in this environment. Server Components need an absolute API origin, so they
          require <code>NEXT_PUBLIC_API_BASE_URL</code> to be set.
        </p>
      </section>

      {/* ------------------------------------------------------------- notes */}
      <section className="mt-12" aria-labelledby="notes-heading">
        <h2 id="notes-heading" className="type-section-title">
          Notes
        </h2>
        <ul className="type-body mt-3 list-disc space-y-2 pl-5">
          <li>
            The existing Vite application is unchanged and remains the live storefront.
            This application is additive and deploys separately.
          </li>
          <li>
            Authentication still uses the backend&rsquo;s OTP and Google flows and the same
            JWT. No new authentication system has been introduced.
          </li>
          <li>
            This application is <code>noindex</code> while migrating, so a preview
            deployment cannot compete with the live site in search results.
          </li>
        </ul>
      </section>

      <p className="mt-12">
        <Link
          href="/"
          className="type-btn inline-flex min-h-[42px] cursor-pointer items-center justify-center rounded-md border-2 border-chocolate px-7 py-3 text-sm uppercase tracking-wide text-espresso transition-all hover:border-espresso active:scale-[0.98]"
        >
          Back
        </Link>
      </p>
    </main>
  )
}
