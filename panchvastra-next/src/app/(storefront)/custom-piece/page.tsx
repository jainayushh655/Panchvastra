import type { Metadata } from 'next'
import { CustomPieceBuilder } from '@/components/custom/CustomPieceBuilder'
import { IconWhatsApp } from '@/components/icons'
import { publicPageMetadata } from '@/lib/metadata'
import { whatsAppPageUrl } from '@/lib/siteUrls'
import { getCustomPieceOptions } from '@/services/server/catalog'

/**
 * Custom Piece — the "design your own" page.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * SERVER SHELL, ONE CLIENT ISLAND
 * ──────────────────────────────────────────────────────────────────────────────
 * This file is a Server Component. It reads the option catalogue, renders every piece of
 * the page that is just copy — the masthead, the four promises, the WhatsApp link, the
 * "How it works" strip — and hands the form to `CustomPieceBuilder`, the single
 * `'use client'` boundary.
 *
 * The masthead and the promises rail travel into the island as PROPS rather than being
 * written inside it. React keeps a Server Component passed that way server-rendered, so
 * that copy costs no client JavaScript — while still sitting inside the island's grid,
 * which is what the desktop layout needs: the rail spans both grid rows so step cards 01
 * and 02 tuck under the masthead in column one. Splitting the grid to move them out would
 * change that layout, and the Vite page's layout is what this migration preserves.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED FROM THE VITE PAGE, AND WHAT DID NOT
 * ──────────────────────────────────────────────────────────────────────────────
 * Not changed: every step, option, label, placeholder, sanitiser, validation rule, error
 * message, the 10 MB / PNG-JPG-PDF file rules, the multipart request and its field names,
 * the "at least a file or a description" rule, the one-colour and no-colour notes, the Size
 * Guide dialog, the draft parked across sign-in, the five-second confirmation, and the
 * requirement to be signed in to SUBMIT while the builder stays explorable signed out.
 *
 * Changed: where the options are fetched (server, not a browser `useEffect`), so the real
 * garments are in the first paint; `useDocumentTitle` became a `metadata` export; the
 * post-sign-in return path travels as `?next=` instead of react-router's `location.state`;
 * option artwork goes through `BackendImage`; and the WhatsApp mark comes from the shared
 * `components/icons` instead of a fourth local copy of the same path.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THERE IS NO ROUTE GUARD ON THIS PAGE
 * ──────────────────────────────────────────────────────────────────────────────
 * Deliberate, and it matches Vite exactly: the page is PUBLIC. A shopper can build their
 * piece, see the prices of nothing and the options of everything, and is only asked to sign
 * in at the moment they submit — at which point their draft is parked and restored. Wrapping
 * this in `ProtectedRoute` would be a behaviour regression and would also make the page
 * uncrawlable. The backend enforces the session on `POST /v1/custom_requests/`, which is
 * the only check that counts.
 */

const INTRO = 'A few simple steps to create something that’s truly yours.'

export const metadata: Metadata = publicPageMetadata({
  title: 'Custom Piece',
  description:
    'Design your own Panchvastra. Choose a garment, colour, size and print type, upload your artwork or describe your idea, and we will craft it for you.',
  canonical: '/custom-piece',
})

/* ----------------------------------------------------------------------------- icons */
/* Local to this file: layout glyphs used only by the server-rendered copy below. The
   WhatsApp mark is NOT here — it is the shared one from `components/icons`. */

const S = { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' } as const

const IconShield = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" strokeWidth={1.5} strokeLinejoin="round" />
    <path d="m9 12 2.2 2.2L15.5 10" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconGear = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
    <path
      strokeWidth={1.5}
      strokeLinejoin="round"
      d="M12 3.5l1.3 2.2 2.5-.5.5 2.5 2.2 1.3-1.4 2.1 1.4 2.1-2.2 1.3-.5 2.5-2.5-.5L12 20.5l-1.3-2.2-2.5.5-.5-2.5-2.2-1.3L4.9 13 3.5 10.9l2.2-1.3.5-2.5 2.5.5z"
    />
  </svg>
)
const IconTruck = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <path
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 6.75h10.5v8.5H3zM13.5 9.75H17l3 3v2.5h-6.5zM7.25 17.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5zM17.25 17.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5z"
    />
  </svg>
)
const IconBox = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <path d="M12 3.5 20 8v8l-8 4.5L4 16V8z" strokeWidth={1.5} strokeLinejoin="round" />
    <path d="M4 8l8 4.5L20 8M12 12.5V20.5" strokeWidth={1.5} strokeLinejoin="round" />
  </svg>
)
const IconBulb = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <path d="M9.5 17.5h5M10 20.5h4" strokeWidth={1.6} strokeLinecap="round" />
    <path d="M12 3.5a5.5 5.5 0 0 1 3.3 9.9c-.5.4-.8 1-.8 1.6v.5h-5v-.5c0-.6-.3-1.2-.8-1.6A5.5 5.5 0 0 1 12 3.5z" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
)
const IconChat = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <path d="M4.5 5.5h15v11h-8.5L6.5 20v-3.5h-2z" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
)
const IconCheckCircle = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <circle cx="12" cy="12" r="8.5" strokeWidth={1.6} />
    <path d="m8.3 12.2 2.5 2.5 4.9-5.2" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconArrowRight = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16m0 0-6-6m6 6-6 6" />
  </svg>
)

const PROMISES = [
  { Icon: IconShield, label: 'Premium quality materials' },
  { Icon: IconGear, label: 'Made just for you' },
  { Icon: IconTruck, label: '5–7 business days' },
  { Icon: IconBox, label: 'Secure packaging' },
]

const HOW_IT_WORKS = [
  { Icon: IconBulb, step: '01', title: 'Create', copy: 'Upload your design or share your idea.' },
  { Icon: IconChat, step: '02', title: 'Review', copy: 'We refine and confirm it with you.' },
  { Icon: IconCheckCircle, step: '03', title: 'Approve', copy: 'Approve the final design.' },
  { Icon: IconGear, step: '04', title: 'Craft', copy: 'We bring it to life.' },
  { Icon: IconBox, step: '05', title: 'Deliver', copy: 'Your custom Panchvastra arrives at your doorstep.' },
]

/** Column one, row one of the builder's grid. Server-rendered copy, no client JavaScript. */
function Masthead() {
  return (
    <div className="min-w-0 lg:col-start-1 lg:row-start-1">
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
        Custom Panchvastra
      </p>
      <h1 className="mt-2 font-display text-[2.1rem] font-bold uppercase leading-[1.02] tracking-tight text-black sm:text-5xl lg:text-[3.4rem]">
        Build Your Piece.
      </h1>
      <p className="mt-3 text-sm text-zinc-600 sm:text-base">{INTRO}</p>
      <span className="mt-5 block h-px w-14 bg-zinc-300" aria-hidden />
    </div>
  )
}

/**
 * Column two of the builder's grid, spanning both rows.
 *
 * The WhatsApp number comes from `lib/siteUrls`, the same source the footer, the policy
 * pages and the Help Desk read — nothing is hardcoded here.
 */
function PromisesRail() {
  return (
    <aside className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-1">
      <h2 className="font-display text-lg font-bold uppercase leading-tight tracking-tight text-black">
        Your idea.
        <br />
        Our craft.
      </h2>
      <span className="mt-3 block h-px w-10 bg-zinc-300" aria-hidden />

      <ul className="mt-5 space-y-4">
        {PROMISES.map(({ Icon, label }) => (
          <li key={label} className="flex items-center gap-3">
            <Icon className="size-[22px] shrink-0 text-black" />
            <span className="text-sm text-zinc-700">{label}</span>
          </li>
        ))}
      </ul>

      <span className="mt-6 block h-px w-full bg-soft-beige" aria-hidden />

      <h3 className="mt-6 font-sans text-sm font-bold uppercase tracking-[0.08em] text-black">Need help?</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600">
        Have a design idea or any questions? We&rsquo;re here on WhatsApp.
      </p>
      <a
        href={whatsAppPageUrl()}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2.5 rounded-xl border border-sand bg-white px-4 text-sm font-semibold text-black transition-colors hover:border-black"
      >
        <IconWhatsApp className="size-[18px]" />
        Chat with us
        <IconArrowRight className="size-4" />
      </a>
    </aside>
  )
}

export default async function CustomPiecePage() {
  /*
   * Anonymous by construction — see `getCustomPieceOptions`. This endpoint changes its
   * response for a privileged token, so a signed-in shopper must be offered exactly the
   * same options as a signed-out one.
   *
   * `ok` is not used to render an error here: the island re-reads the endpoint from the
   * browser when it is handed nothing, and only shows the Vite page's load-error line if
   * that also fails. That is what keeps a page prerendered before the API was reachable
   * from being a dead end.
   */
  const { options } = await getCustomPieceOptions()

  return (
    <div className="bg-cream">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
        <CustomPieceBuilder initialOptions={options} masthead={<Masthead />} aside={<PromisesRail />} />

        {/* ============ how it works ============ */}
        {/* Outside the form in the Vite page too, so it is rendered straight by the server. */}
        <section className="mt-10 rounded-2xl border border-soft-beige bg-white px-5 py-7 sm:px-8">
          <div className="grid grid-cols-1 gap-7 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center lg:gap-10">
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                How it works
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold uppercase leading-[1.05] tracking-tight text-black sm:text-3xl">
                From idea
                <br />
                to you.
              </h2>
              <p className="mt-2 text-sm text-zinc-500">A simple process, made for you.</p>
            </div>

            <ol className="grid grid-cols-1 gap-6 sm:grid-cols-3 lg:grid-cols-5 lg:gap-3">
              {HOW_IT_WORKS.map(({ Icon, step, title, copy }, index) => (
                <li key={step} className="relative flex flex-col items-center text-center">
                  <Icon className="size-7 text-black" />
                  <span className="mt-2.5 block text-[11px] font-bold tracking-[0.14em] text-zinc-400">{step}</span>
                  <span className="mt-1 block font-sans text-xs font-bold uppercase tracking-[0.1em] text-black">
                    {title}
                  </span>
                  <span className="mt-1.5 block text-xs leading-snug text-zinc-500">{copy}</span>
                  {/* Connector between steps — decorative, and only where there is a next
                      step on the same row. */}
                  {index < HOW_IT_WORKS.length - 1 ? (
                    <span className="absolute -right-2 top-3 hidden text-zinc-300 lg:block" aria-hidden>
                      →
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>
    </div>
  )
}
