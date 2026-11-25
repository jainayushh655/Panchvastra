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
 * Metadata for a signed-in customer page — the cart, the wishlist, and the account pages
 * that follow.
 *
 * `noindex` here is PERMANENT, not part of the migration-wide block above. These pages
 * show one shopper's own data and have nothing to offer a search result; a crawler
 * reaching `/cart` can only ever see the signed-out shell. `follow` stays on, so the
 * ordinary storefront links in the header and footer are still discovered through them.
 *
 * `follow` can be turned off for a page where even link discovery is pointless. Checkout
 * passes `{ follow: false }`: it is a transactional page reachable only with a cart, and a
 * crawler following links out of it gains nothing the storefront does not already expose.
 *
 * No canonical is declared: a page that must not be indexed has no canonical to assert.
 */
export function accountPageMetadata(
  title: string,
  { follow = true }: { follow?: boolean } = {},
): Metadata {
  return {
    title,
    robots: { index: false, follow },
  }
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

/**
 * Metadata for a PUBLIC, indexable storefront page — About, Help Desk, Custom Piece and
 * the policy pages.
 *
 * WHY THIS EXISTS. `/`, `/shop` and `/product/[id]` each hand-rolled the same five-key
 * block, and Phase 4F adds six more public pages. Writing it eleven times is eleven
 * chances for one page to lose its canonical or ship a title that does not match its Open
 * Graph title. The shape below is the one those three pages already established, lifted
 * unchanged — this helper introduces no new SEO policy, it just stops the policy being
 * retyped.
 *
 * ⚠️ IT DELIBERATELY DOES NOT TOUCH `robots`. The site-wide `noindex, nofollow` from
 * Phase 2 (see `rootMetadata`) is still in force while this application runs alongside the
 * live Vite storefront, and these pages inherit it. Everything a crawler needs is present
 * and correct; lifting the block is the Phase 7 cutover decision, not a per-page one. A
 * helper that quietly set `index: true` would publish six pages into search results ahead
 * of that decision.
 *
 * `canonical` is required rather than optional, and that is the point: it is the one key
 * `skipTrailingSlashRedirect` makes mandatory (`/about` and `/about/` both return 200), so
 * a public page cannot be added without naming its single address.
 *
 * `title` is the bare page title — the root `title.template` appends `· PANCHVASTRA`.
 * Open Graph and Twitter get the composed form, because those are read standalone with no
 * template applied.
 */
export function publicPageMetadata({
  title,
  description,
  canonical,
}: {
  title: string
  description: string
  canonical: string
}): Metadata {
  const composed = `${title} · ${SITE_NAME}`

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: SITE_NAME,
      title: composed,
      description,
      locale: 'en_IN',
    },
    twitter: {
      card: 'summary_large_image',
      title: composed,
      description,
    },
  }
}
