import type { Metadata } from 'next'
import { HelpDeskForm } from '@/components/support/HelpDeskForm'
import { IconInstagram, IconMail, IconWhatsApp } from '@/components/icons'
import { publicPageMetadata } from '@/lib/metadata'
import {
  instagramHandle,
  instagramPageUrl,
  supportEmail,
  supportEmailUrl,
  whatsAppPageUrl,
} from '@/lib/siteUrls'

/**
 * Help Desk — the customer-facing support page.
 *
 * It replaced the Vite app's previous Contact page, which was an explicit UI mock: a fake
 * submit ("this is a UI mock; wire to your CRM / email API"), an invented email address
 * and placeholder social links. Every contact detail here comes from `lib/siteUrls`, the
 * same source the footer and the policy pages read — nothing is invented.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * SERVER SHELL, ONE CLIENT ISLAND
 * ──────────────────────────────────────────────────────────────────────────────
 * This file is a Server Component. The heading, the intro and all three contact rows are
 * server markup — `siteUrls` only reads environment values, so none of it needs a browser
 * — and `HelpDeskForm` is the single `'use client'` boundary. A crawler and a reader on a
 * slow connection both get the support routes (email, WhatsApp, Instagram) in the first
 * paint, whether or not the form's JavaScript has arrived.
 *
 * `/contact` 308-redirects here (see `next.config.ts`), and the canonical below names this
 * URL, so the two addresses the Vite app served the same page on are consolidated into one.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ONE INTENTIONAL VISUAL DIFFERENCE
 * ──────────────────────────────────────────────────────────────────────────────
 * The Instagram glyph comes from `components/icons`, which holds the footer's version
 * (stroke 1.75, 18×18 rect). The Vite Help Desk drew its own near-identical variant
 * (stroke 1.6, 17×17). Using one shared mark rather than keeping a second copy that
 * differs by a hairline is the point of that module; the WhatsApp and mail marks are
 * unchanged.
 */

const INTRO = 'Questions, orders, or anything else? We’re here to help.'

export const metadata: Metadata = publicPageMetadata({
  title: 'Help Desk',
  description:
    'Contact the Panchvastra team about an order, sizing, a payment issue or anything else — by message, email, WhatsApp or Instagram.',
  canonical: '/help-desk',
})

function IconArrowUpRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17 17 7m0 0H8m9 0v9" />
    </svg>
  )
}

/**
 * The three support routes, in the Vite page's order. Each value is read from `siteUrls`,
 * so a staging inbox or a different business number is picked up here with no edit.
 */
const contactRows = [
  {
    key: 'email',
    Icon: IconMail,
    title: 'Email',
    detail: supportEmail(),
    href: supportEmailUrl(),
    external: false,
  },
  {
    key: 'whatsapp',
    Icon: IconWhatsApp,
    title: 'WhatsApp',
    detail: 'Chat with us about an order',
    href: whatsAppPageUrl(),
    external: true,
  },
  {
    key: 'instagram',
    Icon: IconInstagram,
    title: 'Instagram',
    detail: instagramHandle(),
    href: instagramPageUrl(),
    external: true,
  },
]

export default function HelpDeskPage() {
  return (
    /*
     * Sized to be read without scrolling. Every gap on this page was tuned so the heading,
     * all four fields and the submit button fit inside one viewport on a short laptop
     * screen — previously the button sat below the fold and the form could not be
     * completed without scrolling to find it.
     */
    <div className="mx-auto max-w-5xl px-4 py-7">
      {/*
        Two columns on desktop with a hairline between them; below `lg` the columns stack
        and the divider disappears, because a vertical rule between stacked blocks is just
        a stray line. `divide-x` handles both without a separate border element.
      */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-0 lg:divide-x lg:divide-zinc-200">
        {/* ------------------------------------------------------------ form */}
        <div className="min-w-0 lg:pr-10">
          <h1 className="type-page-title">Help Desk</h1>
          <p className="mt-1 text-sm text-zinc-600">{INTRO}</p>

          <HelpDeskForm />
        </div>

        {/* ------------------------------------------------------- contact rows */}
        <aside className="min-w-0 lg:pl-10">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">
            Other ways to reach us
          </h2>

          <ul className="mt-3 space-y-1">
            {contactRows.map((row) => (
              <li key={row.key}>
                <a
                  href={row.href}
                  {...(row.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                  className="group flex items-center gap-3.5 rounded-xl border border-transparent px-3 py-2.5 transition-colors hover:border-sand hover:bg-soft-beige"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-black transition-colors group-hover:border-black">
                    <row.Icon className="size-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-black">{row.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">{row.detail}</span>
                  </span>
                  {row.external ? (
                    <IconArrowUpRight className="size-4 shrink-0 text-zinc-400 transition-colors group-hover:text-black" />
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
