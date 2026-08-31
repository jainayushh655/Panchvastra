import type { ReactNode } from 'react'

/**
 * Split-screen shell shared by the customer login, signup and admin login screens.
 *
 * Layout only — it holds no authentication state and makes no requests. Desktop puts a
 * black editorial brand panel on the left and the form on the right at roughly 50/50;
 * below `lg` the panel collapses to a compact banner above the form so the form never
 * gets squeezed into a narrow column.
 *
 * The brand panel is built from CSS and type rather than an image, so it stays sharp,
 * needs no new asset or dependency, and matches the site's black/white editorial language.
 * Its ambient motion is disabled under `prefers-reduced-motion` (see index.css).
 */
export function AuthSplitLayout({
  eyebrow,
  headline,
  tagline = 'Premium essentials, made to be worn every day.',
  children,
}: {
  /** Small uppercase label above the headline in the brand panel. */
  eyebrow: string
  /** Large editorial headline in the brand panel. */
  headline: ReactNode
  /** Supporting line under the headline. */
  tagline?: string
  /** The authentication form. */
  children: ReactNode
}) {
  return (
    <div className="min-h-svh bg-[#f7f7f5] lg:grid lg:grid-cols-2">
      {/* ---------------------------------------------------------- brand panel */}
      <aside
        className="relative flex min-h-[168px] items-end overflow-hidden bg-black px-6 py-8 sm:min-h-[200px] lg:min-h-svh lg:px-12 lg:py-14"
        aria-hidden
      >
        {/* Very slow, very faint diagonal weave — the "fabric" texture, drawn in CSS. */}
        <div
          className="pv-auth-drift pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(135deg, #ffffff 0 1px, transparent 1px 22px), repeating-linear-gradient(45deg, #ffffff 0 1px, transparent 1px 22px)',
          }}
        />

        {/* Single soft light pass, so the panel is never completely static. */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="pv-auth-sweep absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent via-white/10 to-transparent" />
        </div>

        {/* Hairline frame, echoing the thin borders used across the site. */}
        <div className="pointer-events-none absolute inset-4 border border-white/15 lg:inset-8" />

        <div className="relative">
          <p className="text-[10px] font-bold uppercase tracking-[0.34em] text-white/60">{eyebrow}</p>
          <p className="mt-3 text-3xl font-bold uppercase leading-[0.95] tracking-tight text-white sm:text-4xl lg:text-6xl">
            {headline}
          </p>
          <div className="mt-5 hidden h-px w-16 bg-white/40 lg:block" />
          <p className="mt-5 hidden max-w-xs text-sm leading-relaxed text-white/55 lg:block">
            {tagline}
          </p>
        </div>
      </aside>

      {/* ---------------------------------------------------------- form side */}
      <main className="flex items-center justify-center px-4 py-10 sm:px-6 lg:min-h-svh lg:px-12 lg:py-14">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
