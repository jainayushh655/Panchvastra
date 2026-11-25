/**
 * Shared contact and brand glyphs.
 *
 * WHY THIS FILE EXISTS. The WhatsApp mark is a 1.2 KB SVG path that the Vite application
 * carries in three separate files — the footer, the Help Desk and the Custom Piece page —
 * each a byte-for-byte copy. Two of those pages arrive in Phase 4F. Rather than make it
 * four copies, the glyphs the storefront shares now live here once.
 *
 * These are plain function components with no hooks and no browser API, so the SAME import
 * works from a Server Component and from a Client Component. There is deliberately no
 * `'use client'` directive: adding one would drag every page that renders a contact icon
 * into the client bundle, which is exactly what the policy and About pages must avoid.
 *
 * The definitions are moved from `components/layout/Footer.tsx` UNCHANGED — same
 * viewBox, same paths, same stroke weights — so the footer renders identically to before.
 * Nothing here is redrawn.
 *
 * Every glyph takes `className` only and is `aria-hidden`: these sit beside real text in
 * every call site, so announcing them would read the label twice. An icon that is ever
 * used as the only content of a link needs an accessible name on the LINK, not here.
 */

/**
 * The official WhatsApp mark.
 *
 * Solid-filled, which is how the brand is always set — it does not take the stroke weight
 * the outline glyphs beside it use. A brand mark is not something to approximate by eye,
 * so this is the real glyph rather than a hand-drawn bubble-and-handset.
 */
export function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

/** Instagram — rounded square, lens, flash dot. */
export function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="12" cy="12" r="4.25" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="17.25" cy="6.75" r="1.1" fill="currentColor" />
    </svg>
  )
}

/** Envelope — used beside an email address. */
export function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth={1.6} />
      <path d="m3.5 7 8.5 6 8.5-6" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Handset — used for click-to-call. */
export function IconPhone({ className }: { className?: string }) {
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
