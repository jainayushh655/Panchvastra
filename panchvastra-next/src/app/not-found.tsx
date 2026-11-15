import Link from 'next/link'

/**
 * 404 — a Server Component, rendered for an unmatched route and for any `notFound()` call.
 *
 * BEHAVIOUR CHANGE, AND IT IS THE RIGHT ONE. The Vite app has no 404: two
 * `<Route path="*" element={<Navigate to="/" replace />} />` catch-alls silently redirect
 * every unknown URL to the homepage. That is bad for shoppers (a mistyped product link
 * looks like the site "worked") and actively bad for SEO — a crawler asking for a
 * discontinued product URL gets HTTP 200 and homepage content, which is a soft 404 and
 * can get the homepage itself devalued.
 *
 * This page returns a real 404 status. Phase 4 keeps the one redirect that IS intentional
 * — `/contact` to `/help-desk`, which exists for already-indexed links — as an explicit
 * route, not a catch-all.
 */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="type-eyebrow">404</p>
      <h1 className="type-page-title mt-2">Page not found</h1>
      <p className="type-body mt-3">
        The page you were looking for doesn&rsquo;t exist, or it has moved.
      </p>

      <Link
        href="/"
        className="type-btn mt-8 inline-flex min-h-[42px] cursor-pointer items-center justify-center rounded-md border border-chocolate bg-chocolate px-7 py-3 text-sm uppercase tracking-wide text-cream transition-all hover:bg-espresso active:scale-[0.98]"
      >
        Back to Panchvastra
      </Link>
    </main>
  )
}
