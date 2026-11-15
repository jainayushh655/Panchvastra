'use client'

import { useEffect } from 'react'

/**
 * Route-level error boundary.
 *
 * Catches a render or data error anywhere below it and offers a retry. Must be a Client
 * Component — it holds the `reset` callback and an effect.
 *
 * WHAT IS SHOWN, AND WHY SO LITTLE. `error.message` is NOT rendered. In production Next
 * already redacts server errors to a generic string, but a client-side error message can
 * carry anything that happened to be in scope, and this backend's 5xx responses can
 * contain a Django debug page or raw SQL. The whole API layer follows the rule that a 5xx
 * body is never surfaced to a user; this boundary follows the same rule.
 *
 * `error.digest` IS shown. It is a short server-generated hash with no payload, and it is
 * the only way to tie what a customer saw to a line in the server logs.
 *
 * Phase 6 adds error reporting here. Deliberately not wired to a third-party service yet
 * — that is a dependency and a data-egress decision, not a foundation one.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Console only, for now: visible to a developer, sent nowhere.
    console.error('[panchvastra] route error', error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-svh max-w-lg flex-col items-center justify-center px-4 py-16 text-center">
      <p className="type-eyebrow">Something went wrong</p>
      <h1 className="type-page-title mt-2">We couldn&rsquo;t load this page</h1>
      <p className="type-body mt-3">
        This is usually temporary. Try again, and if it keeps happening please get in
        touch.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="type-btn inline-flex min-h-[42px] cursor-pointer items-center justify-center rounded-md border border-chocolate bg-chocolate px-7 py-3 text-sm uppercase tracking-wide text-cream transition-all hover:bg-espresso active:scale-[0.98]"
        >
          Try again
        </button>
      </div>

      {error.digest ? (
        <p className="type-body-sm mt-8">
          Reference: <code className="font-sans font-semibold text-black">{error.digest}</code>
        </p>
      ) : null}
    </main>
  )
}
