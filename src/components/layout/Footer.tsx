import { Link } from 'react-router-dom'
import { instagramPageUrl, phoneCallUrl, whatsAppPageUrl } from '@/lib/siteUrls'

const exploreLinks = [
  { label: 'T-shirts', to: '/shop?category=regular-tee' },
  { label: 'Shorts', to: '/shop?category=shorts' },
  { label: 'New arrivals', to: '/shop?sort=new-arrival' },
  { label: 'Best sellers', to: '/shop?sort=bestseller' },
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

const connectChannels = [
  { label: 'Instagram', href: instagramPageUrl(), icon: IconInstagram, external: true },
  { label: 'WhatsApp', href: whatsAppPageUrl(), icon: IconWhatsApp, external: true },
  { label: 'Call', href: phoneCallUrl(), icon: IconPhone, external: false },
] as const

export function Footer() {
  const wa = whatsAppPageUrl()
  const ig = instagramPageUrl()
  const tel = phoneCallUrl()

  return (
    <footer className="mt-auto border-t border-zinc-800 bg-[radial-gradient(circle_at_top,rgba(214,179,109,0.12),transparent_34%),linear-gradient(180deg,#191611,#0e0d0b)] px-4 py-12 text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-20">

        {/* HEADING */}
        <h2 className="text-center font-display text-sm font-bold uppercase tracking-[0.28em] text-[#e9d7b4]">
          Stay connected
        </h2>

        <div
          className="mx-auto mt-3 h-px max-w-xs bg-gradient-to-r from-transparent via-[#c7a56a] to-transparent"
          aria-hidden
        />

        {/* SOCIAL BUTTONS */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 overflow-hidden rounded-full border border-[#6f5c44] bg-white/5 shadow-[0_18px_60px_-28px_rgba(0,0,0,0.65)] backdrop-blur-sm">
          {connectChannels.map(({ label, href, icon: Icon, external }) => (
            <a
              key={label}
              href={href}
              {...(external
                ? {
                    target: '_blank',
                    rel: 'noopener noreferrer',
                  }
                : {})}
              className="flex items-center justify-center gap-2 border-b border-zinc-800 px-4 py-3.5 text-[10px] font-bold uppercase tracking-wider text-[#f1e4c8] transition-colors hover:bg-white/10 sm:gap-3 sm:px-6 sm:py-4 sm:text-xs md:border-b-0 md:border-r first:border-none md:last:border-none"
            >
              <Icon className="size-4 shrink-0 sm:size-5" />
              <span>{label}</span>
            </a>
          ))}
        </div>

        {/* CONNECTING LINES */}
        <div className="mt-8 grid grid-cols-3 gap-12 justify-items-center">
          <div className="h-6 w-px rounded-full bg-gradient-to-b from-[#c7a56a] to-transparent" />
          <div className="h-6 w-px rounded-full bg-gradient-to-b from-[#c7a56a] to-transparent" />
          <div className="h-6 w-px rounded-full bg-gradient-to-b from-[#c7a56a] to-transparent" />
        </div>

        {/* FOOTER LINKS - FIXED FOR PERFECT 3-COLUMN CENTERED LAYOUT */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-12 justify-items-center">

          {/* EXPLORE */}
          <div className="w-full text-center">
            <p className="font-display text-[14px] font-bold uppercase tracking-[0.28em] text-[#e9d7b4]">
              Explore
            </p>

            <ul className="mt-6 space-y-2.5 text-sm font-medium uppercase tracking-wide text-zinc-300">
              {exploreLinks.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="transition-colors hover:text-white"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* COMPANY */}
          <div className="w-full text-center">
            <p className="font-display text-[14px] font-bold uppercase tracking-[0.28em] text-[#e9d7b4]">
              Company
            </p>

            <ul className="mt-6 space-y-2.5 text-sm font-medium uppercase tracking-wide text-zinc-300">
              <li>
                <Link
                  to="/about"
                  className="transition-colors hover:text-white"
                >
                  Our story
                </Link>
              </li>
            </ul>
          </div>

          {/* REACH US */}
          <div className="w-full text-center">
            <p className="font-display text-[14px] font-bold uppercase tracking-[0.28em] text-[#e9d7b4]">
              Reach us
            </p>

            <ul className="mt-6 space-y-2.5 text-sm font-medium uppercase tracking-wide text-zinc-300">
              <li>
                <a
                  href={wa}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  WhatsApp
                </a>
              </li>

              <li>
                <a
                  href={ig}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-white"
                >
                  Instagram
                </a>
              </li>

              <li>
                <a
                  href={tel}
                  className="transition-colors hover:text-white"
                >
                  Call
                </a>
              </li>
            </ul>
          </div>

        </div>

        {/* COPYRIGHT */}
        <p className="mt-12 text-center text-[11px] text-zinc-500">
          © {new Date().getFullYear()} PANCHVASTRA
        </p>

      </div>
    </footer>
  )
}
