/**
 * Server-side reads, for Server Components.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A SEPARATE LAYER AND NOT THE AXIOS CLIENT
 * ──────────────────────────────────────────────────────────────────────────────
 * The browser client (`services/http/client.ts`) reads `localStorage` in a request
 * interceptor. `localStorage` does not exist on the server, so that client can never run
 * in a Server Component. Rather than make the interceptor conditional — which would mean
 * one code path silently sending no credential — the two concerns are split:
 *
 *   - `services/http/client.ts`  — browser, authenticated, axios, full interceptors.
 *   - this file                  — server, ANONYMOUS, `fetch`, Next's cache integration.
 *
 * WHAT THIS IS FOR. Only the PUBLIC catalogue reads that let a page render on the server
 * and therefore be indexable: products, product detail, categories, sub-categories, the
 * auth carousel, and the public custom-piece options. Those are exactly the reads that
 * carry no credential in the Vite app today, so moving them server-side changes nothing
 * about what the backend returns.
 *
 * WHAT THIS IS NOT FOR. Anything authenticated — cart, orders, addresses, profile,
 * checkout, every admin endpoint. Those stay in the browser. There is deliberately no
 * token parameter on these functions: adding one would invite a Server Component to read
 * a session it cannot legitimately see, and would also make the response user-specific
 * while Next was caching it. Once the Phase 5 cookie bridge exists, authenticated server
 * reads get their own explicitly-uncached helper.
 *
 * WRITES ARE NEVER DONE HERE. No Server Actions for admin CRUD: the multipart image
 * contract is the highest-risk code in the application and it is known-good in the
 * browser. The audit's recommendation was to leave it there.
 */

import { apiOrigin } from '@/lib/env.server'
import { readApiMessage, type ApiEnvelope } from '@/services/http/apiMessage'
import { readPage, toQueryParams, type Page } from '@/services/http/pagination'

/** Revalidation windows, in seconds. One place, so caching is a decision and not a habit. */
export const REVALIDATE = {
  /** Catalogue data: changes when an admin saves, which is not minute-to-minute. */
  catalogue: 300,
  /** Categories and sub-categories: change rarely. */
  taxonomy: 600,
  /** Decorative carousel imagery. */
  decorative: 600,
  /** Opt out entirely — for anything that must never be shared between visitors. */
  never: 0,
} as const

/** Raised for any non-2xx, carrying the status and the backend's own message. */
export class ServerApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ServerApiError'
    this.status = status
  }
}

/**
 * Raised when a server-side read is attempted with no absolute API origin configured.
 *
 * `NEXT_PUBLIC_API_BASE_URL` may legitimately be empty in the browser — an empty base
 * means "same origin", and the `/v1/:path*` rewrite handles it. On the server there is no
 * origin to be relative to, so `fetch('/v1/...')` cannot work. Failing with this specific
 * message beats a confusing "Failed to parse URL" from undici.
 */
export class MissingApiOriginError extends Error {
  constructor(path: string) {
    super(
      `Cannot read ${path} on the server: no API origin is configured. ` +
        'Server Components need an absolute origin — set API_ORIGIN (preferred) or ' +
        'NEXT_PUBLIC_API_BASE_URL in .env.local for development, or in the hosting ' +
        'environment for a deployment.',
    )
    this.name = 'MissingApiOriginError'
  }
}

export type ServerRequestOptions = {
  /** Query parameters. Empty values are dropped by `toQueryParams`. */
  params?: Record<string, string | number | boolean | null | undefined>
  /**
   * Seconds Next may serve a cached response for. `REVALIDATE.never` (0) opts out.
   * Defaults to `REVALIDATE.catalogue`.
   */
  revalidate?: number
  /** Cache tags, so a future admin save can call `revalidateTag` instead of waiting. */
  tags?: string[]
  /** Forwarded to `fetch`, so a Server Component can cancel on navigation. */
  signal?: AbortSignal
}

function buildUrl(path: string, params?: ServerRequestOptions['params']): string {
  const origin = apiOrigin()
  if (!origin) throw new MissingApiOriginError(path)

  const url = new URL(`${origin}${path.startsWith('/') ? path : `/${path}`}`)

  if (params) {
    for (const [key, value] of Object.entries(toQueryParams(params))) {
      url.searchParams.set(key, String(value))
    }
  }

  return url.toString()
}

/**
 * One anonymous GET, returning the envelope.
 *
 * No Authorization header is ever attached — see the header comment. A non-2xx throws
 * `ServerApiError` carrying the backend's own `message`, flattened through the same
 * reader the browser side uses, so a Server Component can decide between `notFound()`
 * and re-throwing to the nearest `error.tsx`.
 */
export async function serverGet<T>(
  path: string,
  options: ServerRequestOptions = {},
): Promise<ApiEnvelope<T>> {
  const { revalidate = REVALIDATE.catalogue, tags, signal } = options

  const response = await fetch(buildUrl(path, options.params), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
    ...(revalidate === REVALIDATE.never
      ? { cache: 'no-store' as const }
      : { next: { revalidate, ...(tags?.length ? { tags } : {}) } }),
  })

  // Read the body before checking status: this backend puts its human-readable `message`
  // in the error body, and that message is what the screens display.
  let body: ApiEnvelope<T> | undefined
  try {
    body = (await response.json()) as ApiEnvelope<T>
  } catch {
    body = undefined
  }

  if (!response.ok) {
    throw new ServerApiError(
      response.status,
      // 5xx bodies on this backend can carry a Django debug page or raw SQL, so they are
      // never surfaced — the same rule the browser error reader applies.
      response.status >= 500
        ? 'The server is temporarily unavailable. Please try again shortly.'
        : readApiMessage(body?.message, `Request failed with status ${response.status}`),
    )
  }

  return body ?? {}
}

/** `serverGet`, unwrapped to `data`. Returns null when the envelope carried none. */
export async function serverGetData<T>(
  path: string,
  options: ServerRequestOptions = {},
): Promise<T | null> {
  const body = await serverGet<T>(path, options)
  return body.data ?? null
}

/** `serverGet`, read as one page of a list endpoint with its pagination block. */
export async function serverGetPage<T>(
  path: string,
  options: ServerRequestOptions = {},
): Promise<Page<T>> {
  return readPage<T>(await serverGet<T[]>(path, options))
}

/** True when server-side reads are possible at all in this environment. */
export function canReadOnServer(): boolean {
  return apiOrigin() !== ''
}
