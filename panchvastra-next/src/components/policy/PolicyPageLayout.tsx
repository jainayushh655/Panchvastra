import type { ReactNode } from 'react'
import Link from 'next/link'
import {
  instagramHandle,
  instagramPageUrl,
  phoneCallUrl,
  supportEmail,
  supportEmailUrl,
  whatsAppPageUrl,
} from '@/lib/siteUrls'

/**
 * Shared shell for the legal/policy pages.
 *
 * Follows the same editorial convention the About page uses — a centred column, uppercase
 * eyebrow, large heading, generous line length — so these pages read as part of the site
 * rather than a bolt-on. Layout only: it renders inside the `(storefront)` layout, so the
 * navbar and footer come from there unchanged.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED FROM THE VITE COMPONENT
 * ──────────────────────────────────────────────────────────────────────────────
 *   - `useDocumentTitle(title)` is GONE. These are Server Components now, and each page
 *     exports its own `metadata`, so the title is in the server HTML instead of being set
 *     by an effect a crawler never runs. `title` is still taken as a prop, because it is
 *     also the visible `<h1>` — the page passes the same string to both, which is what
 *     keeps the tab and the heading from drifting apart.
 *   - The CONTACT DETAILS now come from `lib/siteUrls`. The Vite version hardcoded
 *     `panchvastra9@gmail.com` and `+91 93433 56697` as literals, duplicating values the
 *     project already has one source for — so a staging inbox set through
 *     `NEXT_PUBLIC_SUPPORT_EMAIL` was silently ignored on exactly the pages that publish
 *     the address. Same numbers, same address, read from the helpers.
 *   - `dark:` variants are dropped throughout: this application is intentionally
 *     light-theme-only (`globals.css` never applies `.dark`), so they were inert.
 *
 * Everything else — every class, every rule, the "Last updated" line and the section
 * rhythm — is unchanged.
 *
 * Zero client JavaScript: nothing here touches a browser API.
 */
export function PolicyPageLayout({
  title,
  eyebrow = 'Legal',
  intro,
  lastUpdated,
  children,
}: {
  title: string
  eyebrow?: string
  intro: string
  lastUpdated: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">{eyebrow}</p>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
        {title}
      </h1>

      <p className="mt-5 text-base leading-relaxed text-zinc-600">{intro}</p>

      <p className="mt-6 border-t border-zinc-200 pt-5 text-xs uppercase tracking-[0.14em] text-zinc-500">
        Last updated: {lastUpdated}
      </p>

      <div className="mt-10 space-y-10">{children}</div>

      <ContactBlock />
    </div>
  )
}

/** One numbered-feeling section: heading plus body copy. */
export function PolicySection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-bold uppercase tracking-[0.1em] text-zinc-900 sm:text-xl">
        {heading}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-600 sm:text-base">
        {children}
      </div>
    </section>
  )
}

/** Bulleted list styled for policy copy. */
export function PolicyList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 marker:text-zinc-400">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

/**
 * Flags a statement that depends on business information not recorded anywhere in this
 * project. Shown to the reader rather than filled in with an invented figure.
 *
 * ⚠️ THERE ARE NINE OF THESE ACROSS THE THREE POLICY PAGES, and every one is preserved
 * exactly as the Vite app has it. Each marks a real commitment the business has not yet
 * made — return windows, who pays return shipping, refund turnaround, GST treatment,
 * delivery timelines, data retention, the registered entity and the governing law. They
 * need business sign-off (and the last one a lawyer) BEFORE these pages go live; see the
 * Phase 4F-2 report. Nothing here is inferred or filled in.
 */
export function PolicyPending({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-sand bg-soft-beige px-4 py-3 text-sm leading-relaxed text-zinc-600">
      <span className="font-semibold uppercase tracking-wide text-zinc-900">
        To be confirmed:{' '}
      </span>
      {children}
    </p>
  )
}

/**
 * The business number as the Vite page displays it — `+91 93433 56697`.
 *
 * The DIGITS come from `phoneCallUrl()`, so the link and the text can never disagree and a
 * configured number is honoured. Only the GROUPING is applied here, and only when the
 * number is an Indian one (country code 91 plus ten digits), which is the one format whose
 * convention this project establishes. Any other number is shown as `+<digits>` rather
 * than split into groups invented for it.
 */
function displayPhone(): string {
  const digits = phoneCallUrl().replace(/\D/g, '')
  const india = /^91(\d{5})(\d{5})$/.exec(digits)
  return india ? `+91 ${india[1]} ${india[2]}` : `+${digits}`
}

/**
 * The support routes the site already exposes. No new contact details are introduced —
 * every value is read from `lib/siteUrls`, which is the same source the footer, the
 * checkout and the Help Desk use.
 */
function ContactBlock() {
  return (
    <section className="mt-14 border-t border-zinc-200 pt-8">
      <h2 className="font-display text-lg font-bold uppercase tracking-[0.1em] text-zinc-900">
        Contact Us
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 sm:text-base">
        For any question about this policy, reach the Panchvastra team:
      </p>
      <ul className="mt-4 space-y-2 text-sm sm:text-base">
        <li className="text-zinc-600">
          Email:{' '}
          <a href={supportEmailUrl()} className="font-semibold text-zinc-900 underline underline-offset-2">
            {supportEmail()}
          </a>
        </li>
        <li className="text-zinc-600">
          WhatsApp:{' '}
          <a
            href={whatsAppPageUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-zinc-900 underline underline-offset-2"
          >
            Chat with us
          </a>
        </li>
        <li className="text-zinc-600">
          Phone:{' '}
          <a href={phoneCallUrl()} className="font-semibold text-zinc-900 underline underline-offset-2">
            {displayPhone()}
          </a>
        </li>
        <li className="text-zinc-600">
          Instagram:{' '}
          <a
            href={instagramPageUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-zinc-900 underline underline-offset-2"
          >
            {instagramHandle()}
          </a>
        </li>
        <li className="text-zinc-600">
          Or use the{' '}
          <Link href="/help-desk" className="font-semibold text-zinc-900 underline underline-offset-2">
            Help Desk
          </Link>
          .
        </li>
      </ul>
    </section>
  )
}
