import Link from 'next/link'
import type { Metadata } from 'next'
import { Button } from '@/components/ui/Button'
import { publicPageMetadata } from '@/lib/metadata'

/**
 * About — the brand story page, and the first fully static page of the migration.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * A SERVER COMPONENT WITH NO CLIENT JAVASCRIPT AT ALL
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite page is a Client Component for two reasons, neither of them about this page's
 * content:
 *
 *   1. `useDocumentTitle('About Us')` — sets `document.title` in an effect, which most
 *      crawlers never run. Replaced by the `metadata` export below, so the title is in
 *      the server HTML.
 *   2. `framer-motion`'s `motion.div` — one fade-and-rise on mount. Replaced by the
 *      `pv-page-rise` CSS class, which animates the same 20px over the same 500ms. See
 *      `globals.css`; `framer-motion` is deliberately not a dependency here.
 *
 * With both gone there is nothing left that needs a browser, so this page ships zero
 * route-specific JavaScript. The copy is in the HTML, which is also the whole point for a
 * page whose job is to be read and indexed.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE COPY IS VERBATIM, INCLUDING ONE INCONSISTENCY
 * ──────────────────────────────────────────────────────────────────────────────
 * ⚠️ The story says "three friends" founded Panchvastra and closes on "four minds, one
 * vision". Both statements are in the live Vite page and BOTH ARE PRESERVED EXACTLY as
 * approved — this is published brand copy and not something to quietly correct from a
 * migration. It is flagged for content approval in the Phase 4F-2 report.
 *
 * It is also why the description below and any future structured data avoid the number
 * and the founder count entirely: there is no way to state it without picking a side.
 *
 * `dark:` variants from the Vite markup are dropped: this application is intentionally
 * light-theme-only (`globals.css` never applies `.dark`), so they were inert.
 */

/**
 * The description is assembled from THIS PAGE'S OWN SENTENCES — "not born in a studio …
 * began as a conversation", Indore, 2025, and "clothing that carried meaning". No new
 * marketing claim is introduced, and no business fact appears here that the page does not
 * already state.
 *
 * The site-wide `noindex` from Phase 2 still applies; see `publicPageMetadata`.
 */
export const metadata: Metadata = publicPageMetadata({
  title: 'About Us',
  description:
    'Panchvastra was not born in a studio — it began as a conversation. The story of how it started in Indore in 2025, and why it is built around clothing that carries meaning.',
  canonical: '/about',
})

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <div className="pv-page-rise">
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-zinc-500">
          Our Story
        </p>

        <h1 className="mt-4 text-4xl font-bold tracking-tight text-zinc-900 sm:text-5xl">
          More Than a Brand. A Beginning.
        </h1>

        <div className="mt-10 space-y-6 text-lg leading-relaxed text-zinc-600">
          <p>
            Panchvastra was not born in a studio — it began as a conversation.
          </p>

          <p>
            In 2025, in the heart of Indore, three friends — all software
            engineers by profession — found themselves questioning the pace and
            purpose of the world they were building for. While technology shaped
            their careers, their roots told a different story — one of
            craftsmanship, culture, and clothing that carried meaning.
          </p>

          <p>
            What started as late-night discussions soon turned into a shared
            vision: to build something of their own. Not just a brand, but a
            statement.
          </p>

          <p>
            Panchvastra was created to bring back that lost connection —
            between the fabric and the wearer, between tradition and today.
          </p>
        </div>

        <div className="my-14 border border-zinc-200 bg-soft-beige p-8">
          <p className="text-2xl font-bold uppercase tracking-tight text-zinc-900 sm:text-3xl">
            We don&apos;t chase trends.
          </p>

          <p className="mt-3 text-2xl font-bold uppercase tracking-tight text-black sm:text-3xl">
            We build identity.
          </p>
        </div>

        <p className="text-lg leading-relaxed text-zinc-600">
          Every piece we create carries the spirit of where we started —
          four minds, one vision, and the courage to begin.
        </p>

        {/*
          `Link` wrapping a `Button` reproduces the Vite markup, which renders an anchor
          around a real `<button>`. That is the one thing here worth a second look: nested
          interactive elements are not ideal for assistive technology. It is preserved
          rather than "fixed" because changing it would change the rendered chrome of the
          site's shared `Button` on a page migration — the right place to address it is
          the `Button` component itself, for every call site at once.
        */}
        <div className="mt-12">
          <Link href="/shop">
            <Button size="lg">
              Explore Collection
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
