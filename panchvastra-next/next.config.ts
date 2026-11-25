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

/**
 * True when the configured API origin is this machine or a private network address.
 *
 * Next 16 refuses to optimise an image whose host resolves to a private IP, and says so:
 * "hostname resolved to private IP … use images.dangerouslyAllowLocalIP = true". That
 * guard is right for a public deployment — it is what stops the optimizer being used to
 * fetch internal URLs — but it also means a developer running Django on
 * `http://127.0.0.1:8000` gets a broken image for every product, with a 400 that reads
 * like a configuration error.
 *
 * So the escape hatch below is opened ONLY when the API origin is itself local. On a real
 * deployment `api.panchvastra.com` is a public host, this is false, and the guard stays
 * fully on. The optimizer additionally only accepts hosts in `remotePatterns`, which is
 * this one origin and nothing else, so even when it is open the set of fetchable URLs is
 * exactly the backend the app is already talking to.
 */
function isLocalHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '::1' || hostname.endsWith('.localhost')) return true
  if (/^127\./.test(hostname)) return true
  if (/^10\./.test(hostname)) return true
  if (/^192\.168\./.test(hostname)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)) return true
  return false
}

const apiOriginIsLocal = apiOrigin ? isLocalHostname(apiOrigin.hostname) : false

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

  /**
   * `/contact` -> `/help-desk`, permanently (308).
   *
   * WHAT THE VITE APP DOES, AND WHY THIS IS BETTER. `App.tsx` maps BOTH paths to the same
   * `HelpDeskPage` component:
   *
   *     <Route path="help-desk" element={<HelpDeskPage />} />
   *     <Route path="contact" element={<HelpDeskPage />} />
   *
   * So one page answers on two URLs with no canonical between them — duplicate content,
   * with any ranking the support page earns split across both addresses. The second route
   * exists only so links and bookmarks from when the page was `/contact` keep working,
   * which a redirect does properly: the old URL keeps resolving, and crawlers are told
   * once, authoritatively, where the page now lives.
   *
   * `permanent: true` emits 308 rather than 307, which is what consolidates the two
   * addresses. The Help Desk page then declares `canonical: '/help-desk'` (Phase 4F-3), so
   * the one surviving URL names itself.
   *
   * ⚠️ BOTH SLASH FORMS ARE LISTED ON PURPOSE, and that is because of
   * `skipTrailingSlashRedirect` above: with normalisation off, `/contact/` is NOT folded
   * into `/contact` first, so a single rule would leave the trailing-slash form falling
   * through to a 404. Verified both ways in the browser.
   */
  async redirects() {
    return [
      { source: '/contact', destination: '/help-desk', permanent: true },
      { source: '/contact/', destination: '/help-desk', permanent: true },
    ]
  },

  /**
   * The ONE host whose images may go through the Next image optimizer, published to the
   * browser bundle so `components/BackendImage.tsx` can decide per image without a second
   * variable to keep in step. Empty when no API origin is configured, which disables
   * optimisation rather than risking a 400 from the optimizer.
   *
   * It is deliberately derived from the same `apiOrigin` that builds `remotePatterns`
   * below: the allow-list and the decision to use it cannot drift apart, because they are
   * the same value read twice.
   */
  env: {
    // `host`, not `hostname`: it carries the port, so an image on the right machine but
    // the wrong port is not mistaken for an optimisable one.
    NEXT_PUBLIC_OPTIMIZED_IMAGE_HOST: apiOrigin?.host ?? '',
  },

  images: {
    /**
     * WHAT THE REPOSITORY ACTUALLY ESTABLISHES (Phase 4B review point 1):
     *
     *   - The Django API origin is `https://api.panchvastra.com`. Not a guess: it is the
     *     `/v1` proxy target hardcoded in the Vite `vite.config.ts`, and `src/api/order.ts`
     *     records endpoints "verified 2026-10-03 against https://api.panchvastra.com".
     *   - The frontend NEVER builds or prefixes an image URL. Every mapper passes
     *     `primary_image` / `image_url` straight through (`productMapper`,
     *     `productListMapper`, `productDetailMapper`, `orderMapper`, `authCarousel`), and
     *     the only transformation anywhere is the empty-string fallback to the local
     *     `/images/no-image.png`. So the backend returns ABSOLUTE urls and their host is
     *     whatever it puts in the field.
     *   - No sample response is committed, so which host that is cannot be read off the
     *     repository. It is very likely the Django host above serving `/media/`, but
     *     "likely" is not "confirmed", and no other hostname is invented here.
     *
     * THE RESULT: the API origin's host is allowed, exactly as before. `BackendImage`
     * optimises an image only when its URL is on that host and falls back to an
     * unoptimised render otherwise — so if the images turn out to live on a CDN, they
     * still display correctly and simply go unoptimised until that host is added here.
     * The failure mode this avoids was measured, not assumed: an unlisted host renders
     * valid-looking markup and then answers every `/_next/image` request with
     * `400 "url" parameter is not allowed`.
     */
    remotePatterns: apiOrigin
      ? [
          {
            protocol: apiOrigin.protocol.replace(':', '') as 'http' | 'https',
            hostname: apiOrigin.hostname,
            /*
             * THE PORT IS LOAD-BEARING, and it was missing until the browser proved it.
             *
             * An omitted `port` in a remote pattern means "the protocol's default port
             * only". So an API origin on any other port — a staging backend on :8000, the
             * local fixture server these pages were tested against on :4010 — matched
             * nothing, and `/_next/image` answered 400 for every product photo while the
             * build, the markup and the page all looked healthy. Every image on Shop and
             * on the product page was broken.
             *
             * `URL.port` is '' for a default port, which is exactly what the pattern wants
             * in that case, so `https://api.panchvastra.com` keeps matching as before.
             */
            port: apiOrigin.port,
          },
        ]
      : [],

    /**
     * Opened only for a LOCAL api origin — see `apiOriginIsLocal` above for the full
     * reasoning. False for every public deployment, which is every deployment that
     * matters for this flag.
     */
    dangerouslyAllowLocalIP: apiOriginIsLocal,
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
