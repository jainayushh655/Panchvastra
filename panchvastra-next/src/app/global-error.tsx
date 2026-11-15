'use client'

/**
 * Last-resort boundary, for an error thrown by the ROOT LAYOUT itself.
 *
 * `error.tsx` sits inside the layout, so it cannot catch a failure in the layout — at
 * that point there is no `<html>` or `<body>` to render into. This file replaces the
 * whole document, which is why it must render those tags itself.
 *
 * It therefore CANNOT rely on the application stylesheet: `globals.css` is imported by
 * the layout that just failed. Everything here is inline-styled with literal brand
 * values. That is the one place in this codebase where a hardcoded hex is correct, and
 * the values are the approved palette (cream #F6EBDD, espresso #2B1711, chocolate
 * #3B2118).
 *
 * In practice this should never render. If it does, something is wrong with the layout,
 * the font loader or the provider stack — not with a page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100svh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f6ebdd',
          color: '#2b1711',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          padding: '1rem',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '28rem' }}>
          <p
            style={{
              margin: 0,
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#7a6448',
            }}
          >
            PANCHVASTRA
          </p>

          <h1
            style={{
              margin: '0.5rem 0 0',
              fontFamily: 'ui-serif, Georgia, serif',
              fontSize: '1.75rem',
              fontWeight: 700,
              letterSpacing: '-0.01em',
            }}
          >
            Something went wrong
          </h1>

          <p style={{ margin: '0.75rem 0 0', fontSize: '0.875rem', color: '#634a38' }}>
            The page could not be loaded. Please reload and try again.
          </p>

          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.75rem',
              minHeight: '42px',
              padding: '0.75rem 1.75rem',
              cursor: 'pointer',
              border: '1px solid #3b2118',
              borderRadius: '0.375rem',
              backgroundColor: '#3b2118',
              color: '#f6ebdd',
              fontSize: '0.875rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Reload
          </button>

          {error.digest ? (
            <p style={{ margin: '1.75rem 0 0', fontSize: '0.75rem', color: '#7a6448' }}>
              Reference: {error.digest}
            </p>
          ) : null}
        </div>
      </body>
    </html>
  )
}
