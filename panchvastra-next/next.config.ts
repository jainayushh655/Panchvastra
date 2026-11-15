import type { NextConfig } from 'next'

/**
 * Next configuration.
 *
 * Deliberately small. Everything here exists for a reason recorded in the Phase 1
 * migration audit, and nothing hardcodes a production URL — every origin comes from the
 * environment.
 *
 * This file reads `process.env` directly rather than importing `src/lib/env.server.ts`.
 * The config is evaluated before the application's module graph and its own path aliases
 * are available, so a relative import would be the only option and would duplicate the
 * resolution logic anyway. The two places agree on the same precedence rule:
 * `API_ORIGIN`, falling back to `NEXT_PUBLIC_API_BASE_URL`.
 */

/** Parses an origin from the environment, ignoring anything unusable. */
function readOrigin(raw: string | undefined): URL | null {
  const value = (raw ?? '').trim()
  if (!value) return null

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

const apiOrigin = readOrigin(process.env.API_ORIGIN) ?? readOrigin(process.env.NEXT_PUBLIC_API_BASE_URL)

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Required by the `/v1` rewrite below. Verified empirically, not assumed.
   *
   * Every path in this Django API ends in a slash. Next normalises a trailing slash
   * before rewrites are even consulted, so `GET /v1/products_management/` was being
   * 308-redirected to `/v1/products_management` and the rewrite never fired — confirmed
   * against a throwaway local echo server, which logged no request at all. Had it fired,
   * the slash-less path would then have been bounced again by Django's own `APPEND_SLASH`
   * redirect, and a POST or PUT would have arrived as a GET with no body.
   *
   * Turning the normalisation off makes the rewrite match the real path verbatim. With
   * this set, the echo server receives `/v1/products_management/`, `/v1/orders/notes/?id=7`
   * and `POST /v1/cart_management/` exactly as sent, Authorization header intact.
   *
   * THE TRADE-OFF, stated plainly: page routes no longer redirect either, so
   * `/migration-status` and `/migration-status/` both return 200 instead of one
   * redirecting to the other. That is a duplicate-URL problem for search engines, not a
   * broken route — both render the same page. Phase 7 resolves it with per-route
   * `alternates.canonical` metadata, which is the correct fix and is on that phase's list
   * regardless. Recorded here so the cost is visible rather than discovered later.
   */
  skipTrailingSlashRedirect: true,

  /**
   * Pin the workspace root to THIS directory.
   *
   * Without it, Turbopack walks up, finds the Vite application's `package-lock.json` in
   * the repository root and infers that as the workspace root — it says so in a build
   * warning. That would make the module graph and the file watcher span both
   * applications, which is exactly the isolation this migration depends on: the Vite app
   * must stay the untouched reference and fallback, and a change there must not be able
   * to affect a build here (or vice versa).
   */
  turbopack: {
    root: import.meta.dirname,
  },

  /**
   * `NEXT_PUBLIC_API_BASE_URL` is empty by default, which means the browser calls
   * `/v1/...` on this origin. This rewrite forwards those calls upstream — the direct
   * equivalent of the Vite dev server's `/v1` proxy, and it keeps the backend origin out
   * of the browser bundle and out of CORS entirely.
   *
   * Registered only when an origin is configured. With none, there is no rewrite and no
   * network call is possible, which is what lets `build` run offline against no backend.
   *
   * A rewrite is NOT a redirect: the path is proxied server-side, so the Authorization
   * header the axios client attaches travels with it untouched.
   *
   * ⚠️ `beforeFiles` IS LOAD-BEARING — do not simplify this to a plain array.
   *
   * Returning an array puts the rule in `afterFiles`, which runs AFTER Next's own
   * trailing-slash normalisation. Every path in this API ends in a slash, because the
   * backend is Django with `APPEND_SLASH` behaviour, so `GET /v1/products_management/`
   * would first be 308-redirected to `/v1/products_management`, then proxied without the
   * slash, and then redirected again by Django. Browsers drop the body and method on
   * some of those hops, so writes would silently turn into GETs.
   *
   * `beforeFiles` runs before normalisation and before the filesystem lookup, so the
   * trailing slash survives all the way upstream.
   *
   * ⚠️ `:path(.*)` IS ALSO LOAD-BEARING — do not "tidy" it to `:path*`.
   *
   * A segment matcher (`:path*`) does not match a trailing slash: given
   * `/v1/products_management/` it fails to match at all, the rewrite never fires, and the
   * request falls through to the trailing-slash redirect described above. The catch-all
   * `(.*)` captures the remainder of the path verbatim, slash included, and the
   * destination replays it unchanged.
   *
   * Both of these were verified locally against a throwaway echo server that logs the
   * method and exact URL it receives. No request was made to the real backend.
   */
  async rewrites() {
    if (!apiOrigin) return { beforeFiles: [] }

    return {
      beforeFiles: [
        {
          source: '/v1/:path(.*)',
          destination: `${apiOrigin.origin}/v1/:path`,
        },
      ],
    }
  },

  images: {
    /**
     * ⚠️ UNRESOLVED, carried over from the Phase 1 audit.
     *
     * Every product, category and carousel image is a remote URL returned by the backend,
     * and no absolute image URL appears anywhere in the Vite source — so the host that
     * actually serves them could not be confirmed from the repository. One live product
     * response settles it.
     *
     * Until then: the API origin's own host is allowed, because images served from the
     * Django host are the likely case, and nothing else is guessed. If images turn out to
     * come from a CDN or a blob store, that host is added here. A remote host that is not
     * listed makes `next/image` throw at request time rather than render a broken image,
     * which is the safe direction — a missing pattern is a loud, obvious failure.
     *
     * Phase 4 is the first time a remote image is actually rendered.
     */
    remotePatterns: apiOrigin
      ? [
          {
            protocol: apiOrigin.protocol.replace(':', '') as 'http' | 'https',
            hostname: apiOrigin.hostname,
          },
        ]
      : [],
  },

  /**
   * Kept false on purpose. A build that type-checks is the gate for every phase of this
   * migration; skipping it would let a regression reach a preview deployment.
   *
   * There is no matching `eslint` key: Next 16 removed `next lint` and no longer runs
   * ESLint during `build`, so linting is its own gate (`npm run lint`) and belongs in CI
   * alongside `typecheck` rather than being implied by the build.
   */
  typescript: { ignoreBuildErrors: false },
}

export default nextConfig
