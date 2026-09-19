import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { instagramPageUrl, phoneCallUrl, whatsAppPageUrl } from '@/lib/siteUrls'

/**
 * Shared shell for the legal/policy pages.
 *
 * Follows the same editorial convention the About page already uses — a centred column,
 * uppercase eyebrow, large heading, generous line length — so these pages read as part of
 * the site rather than a bolt-on. Layout only: it renders inside `MainLayout`, so the
 * navbar and footer come from there unchanged.
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
  useDocumentTitle(title)

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:py-16">
      <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zinc-500">{eyebrow}</p>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl dark:text-white">
        {title}
      </h1>

      <p className="mt-5 text-base leading-relaxed text-zinc-600 dark:text-zinc-400">{intro}</p>

      <p className="mt-6 border-t border-zinc-200 pt-5 text-xs uppercase tracking-[0.14em] text-zinc-500 dark:border-zinc-800">
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
      <h2 className="font-display text-lg font-bold uppercase tracking-[0.1em] text-zinc-900 sm:text-xl dark:text-white">
        {heading}
      </h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-400">
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
 */
export function PolicyPending({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-zinc-300 bg-zinc-50 px-4 py-3 text-sm leading-relaxed text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
      <span className="font-semibold uppercase tracking-wide text-zinc-900 dark:text-zinc-200">
        To be confirmed:{' '}
      </span>
      {children}
    </p>
  )
}

/** The support routes the site already exposes. No new contact details are introduced. */
function ContactBlock() {
  return (
    <section className="mt-14 border-t border-zinc-200 pt-8 dark:border-zinc-800">
      <h2 className="font-display text-lg font-bold uppercase tracking-[0.1em] text-zinc-900 dark:text-white">
        Contact Us
      </h2>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600 sm:text-base dark:text-zinc-400">
        For any question about this policy, reach the Panchvastra team:
      </p>
      <ul className="mt-4 space-y-2 text-sm sm:text-base">
        <li className="text-zinc-600 dark:text-zinc-400">
          Email:{' '}
          <a href="mailto:panchvastra9@gmail.com" className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white">
            panchvastra9@gmail.com
          </a>
        </li>
        <li className="text-zinc-600 dark:text-zinc-400">
          WhatsApp:{' '}
          <a href={whatsAppPageUrl()} target="_blank" rel="noopener noreferrer" className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white">
            Chat with us
          </a>
        </li>
        <li className="text-zinc-600 dark:text-zinc-400">
          Phone:{' '}
          <a href={phoneCallUrl()} className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white">
            +91 93433 56697
          </a>
        </li>
        <li className="text-zinc-600 dark:text-zinc-400">
          Instagram:{' '}
          <a href={instagramPageUrl()} target="_blank" rel="noopener noreferrer" className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white">
            @panchvastra_
          </a>
        </li>
        <li className="text-zinc-600 dark:text-zinc-400">
          Or use the{' '}
          <Link to="/contact" className="font-semibold text-zinc-900 underline underline-offset-2 dark:text-white">
            contact form
          </Link>
          .
        </li>
      </ul>
    </section>
  )
}
