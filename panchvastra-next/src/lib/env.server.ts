/**
 * Server-only environment configuration.
 *
 * NOTHING IN THIS FILE IS SENT TO THE BROWSER. These variables have no `NEXT_PUBLIC_`
 * prefix, so Next never inlines them into a client bundle. Any module that imports this
 * file must therefore be server-only too: a Server Component, a Route Handler, or
 * `next.config.ts`. Importing it from a Client Component would compile, but every value
 * would read as empty at runtime — which is why `assertServer` below fails loudly instead.
 *
 * WHY `API_ORIGIN` IS SEPARATE FROM `NEXT_PUBLIC_API_BASE_URL`
 *
 * The two answer different questions, and conflating them is what produced the open
 * question in the Phase 1 audit:
 *
 *   NEXT_PUBLIC_API_BASE_URL — what the BROWSER prefixes its requests with.
 *     Empty (the default) means "same origin": the browser calls `/v1/...` on the Next
 *     server, and the `/v1/:path*` rewrite in `next.config.ts` forwards it upstream. That
 *     has three advantages over pointing the browser straight at the API — no CORS
 *     preflight, no backend origin baked into the JavaScript bundle, and it mirrors the
 *     Vite dev proxy so local development behaves the same way it does today.
 *
 *   API_ORIGIN — the absolute upstream the SERVER talks to.
 *     Used by the rewrite, and by `services/server/serverApi.ts`, which cannot use a
 *     relative URL because there is no origin on the server to be relative to.
 *
 * The Vite app's production setup has exactly one failure mode that this split removes:
 * its `vercel.json` rewrites every path that does not start with `api/` to `index.html`,
 * which includes `/v1/*`. A relative API call there returns HTML. Here, `/v1/*` is a real
 * rewrite rule that is matched before any catch-all, so the same mistake cannot happen.
 *
 * When `API_ORIGIN` is unset it falls back to `NEXT_PUBLIC_API_BASE_URL`, so a deployment
 * that only sets the public variable still works — the browser then calls the API
 * directly, and CORS has to allow it.
 */

/** Thrown when a server-only value is read from the browser bundle. */
function assertServer(name: string): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      `${name} is a server-only environment variable and was read in the browser. ` +
        'Move this call into a Server Component, a Route Handler, or next.config.ts.',
    )
  }
}

function readOrigin(name: string, raw: string | undefined): string {
  const value = (raw ?? '').trim()
  if (!value) return ''

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new Error(`Invalid environment variable ${name}: expected an absolute URL, got "${value}"`)
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Invalid environment variable ${name}: expected http: or https:`)
  }

  return value.replace(/\/+$/, '')
}

/**
 * Absolute upstream origin for server-side reads and for the `/v1` rewrite.
 *
 * Returns `''` when neither variable is configured, which is a supported state: the build
 * and both foundation routes work without it, and `serverApi` raises a specific,
 * actionable error if a server read is attempted anyway.
 */
export function apiOrigin(): string {
  assertServer('API_ORIGIN')
  return (
    readOrigin('API_ORIGIN', process.env.API_ORIGIN) ||
    readOrigin('NEXT_PUBLIC_API_BASE_URL', process.env.NEXT_PUBLIC_API_BASE_URL)
  )
}

/**
 * Presence of the server-only variables — booleans only, never the values.
 *
 * The companion to `envReadiness()` in `env.ts`, for `/migration-status`. Safe to render
 * because it reports configured/not-set and nothing else.
 */
export function serverEnvReadiness(): { name: string; configured: boolean; required: string }[] {
  assertServer('API_ORIGIN')
  return [
    {
      name: 'API_ORIGIN',
      configured: readOrigin('API_ORIGIN', process.env.API_ORIGIN) !== '',
      required: 'Phase 4',
    },
  ]
}
