'use client'

import { Fragment, useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { getCategories } from '@/services/category'
import { categoryNameToSlug } from '@/lib/categorySlug'
import type { CategoryDto } from '@/types/api/CategoryDto'
import { instagramPageUrl, phoneCallUrl, whatsAppPageUrl } from '@/lib/siteUrls'
import { IconInstagram, IconPhone, IconWhatsApp } from '@/components/icons'

/**
 * The storefront footer.
 *
 * Ported from the Vite `Footer`. The torn cream top edge, the fabric photograph with its
 * flat chocolate wash, the four-column grid, the sm-and-below accordions, the hairline
 * rules, the social buttons and the legal row are all unchanged, class for class. Only
 * the links changed: `react-router` `Link to=` -> `next/link` `href=`.
 *
 * The texture is served from `/images/pexels-karola-g-4863035.jpg`, the file already
 * copied into this app's `public/`, at the same path the Vite app uses — so the
 * `backgroundImage` declaration below is identical and no `next/image` rewrite is
 * involved (it is a CSS background, not an `<img>`).
 *
 * It is a Client Component because the Shop column reads the live category list and the
 * mobile headings are real toggles. The category request happens in an effect, so
 * `next build` makes no API call.
 */

/**
 * "New Arrivals" is a SORT of the whole catalogue, not a category, so it is the one entry
 * in this column that is legitimately fixed. Every other entry comes from the categories
 * the admin has actually created — see `useShopLinks`.
 */
const NEW_ARRIVALS_LINK = { key: 'new-arrivals', label: 'New Arrivals', href: '/shop?sort=new-arrival' }

/**
 * The Shop column, built from the live category list.
 *
 * This used to be a hardcoded array, which drifted away from the catalogue the moment the
 * categories changed: it advertised Shorts and Track Pants that no longer exist, and its
 * "Hoodies" entry linked to `?category=hoodies` while the real category is named "Hoodie"
 * and slugs to `hoodie`, so that link landed on an empty Shop page. Reading the real list
 * is what keeps this correct as categories are added and removed, with no further edits
 * here.
 *
 * Slugs are built with `categoryNameToSlug`, the same helper the homepage tiles and the
 * Shop page's own filter use, so a footer link and a tile for the same category always
 * agree.
 *
 * A failed request leaves the list empty rather than falling back to guesses: showing no
 * category is honest, showing one that may not exist is not.
 */
function useShopLinks() {
  const [categories, setCategories] = useState<CategoryDto[]>([])

  useEffect(() => {
    let active = true

    getCategories()
      .then((data) => {
        if (active) setCategories(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        // Decorative navigation: the footer must never break a page it sits under.
        if (active) setCategories([])
      })

    return () => {
      active = false
    }
  }, [])

  return [
    ...categories.map((category) => {
      const slug = categoryNameToSlug(category.name)
      return { key: slug, label: category.name, href: `/shop?category=${slug}` }
    }),
    NEW_ARRIVALS_LINK,
  ]
}

const companyLinks = [
  { label: 'About Us', href: '/about' },
  { label: 'Help Desk', href: '/help-desk' },
]

const legalLinks = [
  { label: 'Refund Policy', href: '/policies/refund-policy' },
  { label: 'Privacy Policy', href: '/policies/privacy-policy' },
  { label: 'Terms of Service', href: '/policies/terms-of-service' },
]

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 9l6 6 6-6" />
    </svg>
  )
}

const socialLinks = [
  { label: 'Instagram', href: instagramPageUrl, Icon: IconInstagram },
  { label: 'WhatsApp', href: whatsAppPageUrl, Icon: IconWhatsApp },
] as const

const linkClass =
  'inline-flex items-center transition-colors hover:text-cream max-sm:min-h-[32px]'

/**
 * One footer link column.
 *
 * Below `sm` it is a collapsible section — a real button with `aria-expanded`, a chevron,
 * and a hairline rule above it — so a phone shows a short, tappable list of headings
 * instead of three cramped columns. From `sm` up the list is always open and the heading is
 * a plain static label, which keeps the desktop four-column layout exactly as it was.
 */
function FooterLinkGroup({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  /*
   * From `sm` up this column carries the hairline that separates it from the one before.
   * The rule sits on the column's left edge and `pl` matches the grid's `gap-x` at each
   * breakpoint, so the line lands optically centred in the channel rather than hugging the
   * column it belongs to. The brand column has no rule, which is why this lives here and
   * not on the grid.
   */
  return (
    <div className="border-t border-cream/15 py-4 sm:border-t-0 sm:border-l sm:border-l-cream/20 sm:py-0 sm:pl-5 lg:pl-8">
      {/* Mobile: the heading is the accordion toggle. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        /*
         * 44px minimum height on the phone accordion header (Phase 4B review point 4).
         * The Vite control is `py-1` around a 16px line, so the whole row is 24px —
         * a heading that is also the only way to open the section, at half the
         * recommended tap height.
         *
         * `min-h-11` rather than more padding: the label, the chevron, the tracking and
         * the rule above it are untouched, and the row only grows when it is below the
         * 44px floor. From `sm` up the button is `hidden` and the desktop footer is
         * unaffected.
         */
        className="flex min-h-11 w-full items-center justify-between gap-4 py-1 text-left sm:hidden"
      >
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-cream">{title}</span>
        <IconChevronDown
          className={`size-4 shrink-0 text-cream/70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Desktop: a plain heading, never interactive. */}
      <p className="hidden text-xs font-bold uppercase tracking-[0.22em] text-cream sm:block">{title}</p>

      <ul
        id={panelId}
        className={`space-y-2.5 text-sm text-cream/85 ${open ? 'mt-3 block' : 'hidden'} sm:mt-5 sm:block`}
      >
        {children}
      </ul>
    </div>
  )
}

export function Footer() {
  const shopLinks = useShopLinks()
  const wa = whatsAppPageUrl()
  const ig = instagramPageUrl()
  const tel = phoneCallUrl()

  return (
    /*
     * Textured fabric background.
     *
     * Both layers ride on this one element, so no wrapper is added and the layout below is
     * untouched: a flat chocolate wash sits above the photo and holds cream text at AA
     * contrast over the fabric's brightest sheen, while 35% of the fold contrast still
     * reads through. `bg-chocolate` stays as the background-COLOUR beneath both, so a
     * failed image request leaves the footer on brand rather than bare.
     */
    <footer
      className="relative mt-auto bg-chocolate bg-cover bg-center bg-no-repeat px-4 pb-10 pt-14 text-cream sm:pt-16"
      style={{
        backgroundImage:
          "linear-gradient(rgba(59, 33, 24, 0.55), rgba(59, 33, 24, 0.55)), url('/images/pexels-karola-g-4863035.jpg')",
      }}
    >
      {/*
        The torn top edge, where the fabric meets the page.

        A cream shape painted over the top of the footer, so the chocolate appears to begin
        on an uneven line instead of a ruled one — which is why the straight `border-t` is
        gone. `preserveAspectRatio="none"` lets the path stretch to any viewport width
        while its height stays fixed, so the edge never grows teeth on a wide monitor or
        flattens out on a phone. It is painted, not laid out: `absolute` keeps it off the
        flow, `pt` above clears the deepest dip, and `fill-cream` ties it to the page
        colour behind the footer rather than hard-coding a hex.
      */}
      <svg
        className="pointer-events-none absolute inset-x-0 top-0 h-7 w-full sm:h-10"
        viewBox="0 0 1440 56"
        preserveAspectRatio="none"
        aria-hidden
        focusable="false"
      >
        <path
          className="fill-cream"
          d="M0 0h1440v24c-26 13-53 5-79 9-41 7-78 20-119 15-39-5-72-24-111-26-45-3-86 17-131 19-38 2-74-11-112-14-43-4-83 11-126 13-40 2-78-12-118-13-45-1-87 17-132 15-37-2-71-18-108-19-30-1-59 9-89 9-41 0-80-14-121-11-28 2-54 13-82 12-29-1-57-11-86-12-9 0-18 1-26 3V0Z"
        />
      </svg>

      <div className="relative mx-auto max-w-6xl">
        {/*
          Four equal columns inside the site's standard centred container, so the group
          reads as one balanced block rather than the brand taking all the slack and
          pushing Shop/Company/Support together on the right. Below `sm` everything stacks
          into one column and the link groups stay accordions — mobile is unchanged.
        */}
        <div className="grid grid-cols-1 gap-y-0 sm:grid-cols-[1.3fr_1fr_1fr_1fr] sm:gap-x-5 sm:gap-y-9 lg:gap-x-8">
          {/* BRAND */}
          <div className="pb-6 sm:pb-0">
            {/* Same `font-display` serif as the navbar wordmark and every section
                heading, so the two wordmarks cannot drift apart. */}
            <p className="font-display text-lg font-bold uppercase tracking-[0.18em] text-cream">Panchvastra</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-cream/70">
              Modular streetwear built for the feed and for everyday rotation.
            </p>
            <div className="mt-5 flex items-center gap-3">
              {socialLinks.map(({ label, href, Icon }) => (
                <a
                  key={label}
                  href={href()}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={label}
                  className="flex size-9 items-center justify-center rounded-md border border-cream/35 text-cream transition-colors hover:border-cream hover:bg-cream/10"
                >
                  <Icon className="size-4" />
                </a>
              ))}
              <a
                href={tel}
                aria-label="Call"
                className="flex size-9 items-center justify-center rounded-md border border-cream/35 text-cream transition-colors hover:border-cream hover:bg-cream/10"
              >
                <IconPhone className="size-4" />
              </a>
            </div>
          </div>

          <FooterLinkGroup title="Shop">
            {shopLinks.map((l) => (
              <li key={l.key}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </FooterLinkGroup>

          <FooterLinkGroup title="Company">
            {companyLinks.map((l) => (
              <li key={l.label}>
                <Link href={l.href} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </FooterLinkGroup>

          <FooterLinkGroup title="Support">
            <li>
              <Link href="/orders" className={linkClass}>
                Track Order
              </Link>
            </li>
            <li>
              <a href={wa} target="_blank" rel="noopener noreferrer" className={linkClass}>
                WhatsApp
              </a>
            </li>
            <li>
              <a href={ig} target="_blank" rel="noopener noreferrer" className={linkClass}>
                Instagram
              </a>
            </li>
            <li>
              <a href={tel} className={linkClass}>
                Call
              </a>
            </li>
          </FooterLinkGroup>
        </div>

        {/*
          Legal row and copyright share one block under a single hairline, with thin pipe
          separators between the links. Client-side `Link`s, so these navigate without a
          full reload.
        */}
        <div className="mt-8 border-t border-cream/25 pt-6">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {legalLinks.map((l, index) => (
              <Fragment key={l.label}>
                {index > 0 ? (
                  <span className="text-cream/30" aria-hidden>
                    |
                  </span>
                ) : null}
                <Link
                  href={l.href}
                  className="inline-flex items-center text-xs text-cream/85 transition-colors hover:text-cream max-sm:min-h-[32px]"
                >
                  {l.label}
                </Link>
              </Fragment>
            ))}
          </div>

          {/* Year stays dynamic — the footer has always rendered it this way. */}
          <p className="mt-4 text-center text-[11px] text-cream/70">
            © {new Date().getFullYear()} PANCHVASTRA. All Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  )
}
