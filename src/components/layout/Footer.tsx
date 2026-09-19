import { Fragment, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { instagramPageUrl, phoneCallUrl, whatsAppPageUrl } from '@/lib/siteUrls'

const shopLinks = [
  { label: 'T-Shirts', to: '/shop?category=regular-tee' },
  { label: 'Shorts', to: '/shop?category=shorts' },
  { label: 'Track Pants', to: '/shop?category=track-pants' },
  { label: 'Hoodies', to: '/shop?category=hoodies' },
  { label: 'New Arrivals', to: '/shop?sort=new-arrival' },
]

const companyLinks = [
  { label: 'About Us', to: '/about' },
  { label: 'Contact', to: '/contact' },
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
  'inline-flex items-center transition-colors hover:text-white max-sm:min-h-[32px]'

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

  return (
    <div className="border-t border-zinc-800 py-4 sm:border-t-0 sm:py-0">
      {/* Mobile: the heading is the accordion toggle. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-4 py-1 text-left sm:hidden"
      >
        <span className="text-xs font-bold uppercase tracking-[0.22em] text-white">{title}</span>
        <IconChevronDown
          className={`size-4 shrink-0 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Desktop: a plain heading, never interactive. */}
      <p className="hidden text-xs font-bold uppercase tracking-[0.22em] text-white sm:block">{title}</p>

      <ul
        id={panelId}
        className={`space-y-2.5 text-sm text-zinc-400 ${open ? 'mt-3 block' : 'hidden'} sm:mt-5 sm:block`}
      >
        {children}
      </ul>
    </div>
  )
}

export function Footer() {
  const wa = whatsAppPageUrl()
  const ig = instagramPageUrl()
  const tel = phoneCallUrl()

  return (
    <footer className="mt-auto border-t border-zinc-800 bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        {/*
          Four equal columns inside the site's standard centred container, so the group
          reads as one balanced block rather than the brand taking all the slack and
          pushing Shop/Company/Support together on the right. Below `sm` everything stacks
          into one column and the link groups stay accordions — mobile is unchanged.
        */}
        <div className="grid grid-cols-1 gap-y-0 sm:grid-cols-4 sm:gap-x-8 sm:gap-y-9 lg:gap-x-10">
          {/* BRAND */}
          <div className="pb-6 sm:pb-0">
            <p className="font-display text-lg font-bold uppercase tracking-[0.18em] text-white">Panchvastra</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-400">
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
                  className="flex size-9 items-center justify-center border border-zinc-700 text-zinc-300 transition-colors hover:border-white hover:text-white"
                >
                  <Icon className="size-4" />
                </a>
              ))}
              <a
                href={tel}
                aria-label="Call"
                className="flex size-9 items-center justify-center border border-zinc-700 text-zinc-300 transition-colors hover:border-white hover:text-white"
              >
                <IconPhone className="size-4" />
              </a>
            </div>
          </div>

          <FooterLinkGroup title="Shop">
            {shopLinks.map((l) => (
              <li key={l.label}>
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
        <div className="mt-8 border-t border-zinc-800 pt-6">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {legalLinks.map((l, index) => (
              <Fragment key={l.label}>
                {index > 0 ? (
                  <span className="text-zinc-700" aria-hidden>
                    |
                  </span>
                ) : null}
                <Link
                  to={l.to}
                  className="inline-flex items-center text-xs text-zinc-400 transition-colors hover:text-white max-sm:min-h-[32px]"
                >
                  {l.label}
                </Link>
              </Fragment>
            ))}
          </div>

          {/* Year stays dynamic — the footer has always rendered it this way. */}
          <p className="mt-4 text-center text-[11px] text-zinc-500">
            © {new Date().getFullYear()} PANCHVASTRA. All Rights Reserved
          </p>
        </div>
      </div>
    </footer>
  )
}
