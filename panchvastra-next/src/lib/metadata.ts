import type { Metadata } from 'next'
import { env } from '@/lib/env'

/**
 * Centralised metadata defaults.
 *
 * WHAT THIS REPLACES. The Vite application has effectively no SEO: a static
 * `<title>PANCHVASTRA</title>`, one `<meta name="description">`, a Google verification
 * tag and favicons in `index.html`, plus a `useDocumentTitle` hook that sets
 * `document.title` inside an effect — which most crawlers never see. There is no
 * canonical, no Open Graph, no Twitter card, no JSON-LD, no robots.txt and no sitemap.
 *
 * The title template below reproduces `useDocumentTitle`'s exact format
 * (`"<page> · PANCHVASTRA"`), so when the pages are migrated in Phases 3–4 each one
 * exports `metadata` or `generateMetadata` and the tab titles come out unchanged — but
 * now in the server-rendered HTML.
 *
 * Per-route metadata, `Product`/`Offer` JSON-LD, `sitemap.ts` and `robots.ts` are Phase 7.
 */

/** Carried over verbatim from the Vite `index.html` so the domain stays verified. */
const GOOGLE_SITE_VERIFICATION = '368LqsvmJQ0YlUTXYfCJECUdsyx9pH_igRsfgkbNJ2I'

/** The exact description the live site serves today. */
export const SITE_DESCRIPTION =
  'PANCHVASTRA — Gen Z streetwear. Regular tees, oversized fits, shorts. Ships across India.'

export const SITE_NAME = 'PANCHVASTRA'

export const rootMetadata: Metadata = {
  /**
   * Needed for Next to resolve relative Open Graph / canonical URLs to absolute ones.
   * Left undefined when `NEXT_PUBLIC_SITE_URL` is unset — Next then emits relative URLs
   * and logs a build-time note, which is correct for a preview deployment and far better
   * than hardcoding a production origin.
   */
  metadataBase: env.siteUrl ? new URL(env.siteUrl) : undefined,

  title: {
    default: SITE_NAME,
    // Matches `useDocumentTitle`: `${title} · PANCHVASTRA`.
    template: `%s · ${SITE_NAME}`,
  },

  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,

  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },

  verification: {
    google: GOOGLE_SITE_VERIFICATION,
  },

  /**
   * ⚠️ NOINDEX WHILE MIGRATING — intentional, and must be revisited in Phase 7.
   *
   * This application is a placeholder running alongside the live Vite site. If a preview
   * deployment were indexed it would compete with the real storefront for the same
   * queries and could surface a migration landing page in search results. Phase 7 removes
   * this block (and adds `robots.ts`) as part of the cutover, after sign-off.
   */
  robots: {
    index: false,
    follow: false,
  },

  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: 'en_IN',
  },

  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
}

/**
 * Metadata for an internal page that must never be indexed, whatever Phase 7 decides
 * about the rest of the site. Used by `/migration-status`.
 */
export function internalPageMetadata(title: string): Metadata {
  return {
    title,
    robots: { index: false, follow: false, nocache: true },
  }
}
