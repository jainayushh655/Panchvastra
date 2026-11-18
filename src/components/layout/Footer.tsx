import { Fragment, useEffect, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { getCategoriesCached } from '@/api/catalogCache'
import { categoryNameToSlug } from '@/lib/categorySlug'
import type { CategoryDto } from '@/types/api/CategoryDto'
import { instagramPageUrl, phoneCallUrl, whatsAppPageUrl } from '@/lib/siteUrls'

/**
 * "New Arrivals" is a SORT of the whole catalogue, not a category, so it is the one entry
 * in this column that is legitimately fixed. Every other entry comes from the categories
 * the admin has actually created — see `useShopLinks`.
 */
const NEW_ARRIVALS_LINK = { key: 'new-arrivals', label: 'New Arrivals', to: '/shop?sort=new-arrival' }

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

    getCategoriesCached()
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
      return { key: slug, label: category.name, to: `/shop?category=${slug}` }
    }),
    NEW_ARRIVALS_LINK,
  ]
}

const companyLinks = [
  { label: 'About Us', to: '/about' },
  { label: 'Help Desk', to: '/help-desk' },
]

const legalLinks = [
  { label: 'Refund Policy', to: '/policies/refund-policy' },
  { label: 'Privacy Policy', to: '/policies/privacy-policy' },
  { label: 'Terms of Service', to: '/policies/terms-of-service' },
]

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="17.25" cy="6.75" r="1.1" fill="currentColor" />
    </svg>
  )
}

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

function IconPhone({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.75}
        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
      />
    </svg>
  )
}

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
        className="flex w-full items-center justify-between gap-4 py-1 text-left sm:hidden"
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
                <Link to={l.to} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </FooterLinkGroup>

          <FooterLinkGroup title="Company">
            {companyLinks.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className={linkClass}>
                  {l.label}
                </Link>
              </li>
            ))}
          </FooterLinkGroup>

          <FooterLinkGroup title="Support">
            <li>
              <Link to="/orders" className={linkClass}>
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
                  to={l.to}
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
