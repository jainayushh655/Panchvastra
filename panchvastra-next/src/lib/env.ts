/**
 * Public environment configuration — read once, validated once.
 *
 * SCOPE. Everything in this file is a `NEXT_PUBLIC_*` variable, which Next inlines into
 * the BROWSER bundle at build time. Nothing secret may ever be added here: no JWT, no
 * Razorpay key secret, no admin token, no database credential. Server-only secrets get
 * their own `env.server.ts` when the first one is actually needed (Phase 5, the httpOnly
 * cookie bridge) — a file the client never imports.
 *
 * WHY THE VALUES ARE READ AS LITERALS. Next only inlines `process.env.NEXT_PUBLIC_FOO`
 * when it is written exactly like that. A computed lookup (`process.env[name]`) silently
 * becomes `undefined` in the browser, so every read below is spelled out in full even
 * though a loop would be shorter.
 *
 * VALIDATION POLICY — deliberately two-tier:
 *   - A variable that is SET but MALFORMED throws at module load. That surfaces during
 *     `next build` rather than as a broken page in production.
 *   - A variable that is UNSET does NOT throw. `apiBaseUrl` defaults to `''`, which means
 *     "same origin, relative path" — byte-for-byte the behaviour of the Vite app's
 *     `import.meta.env.VITE_API_BASE_URL || ""`. This is what lets `npm install`,
 *     `typecheck`, `lint` and `build` all run with no backend reachable and no network.
 *
 * The Vite app's own variables are deliberately NOT read here. The two applications keep
 * independent configuration for the whole migration, so a change to one cannot move the
 * other.
 */

/** Thrown only for a variable that is present and unusable. An absent variable is fine. */
export class EnvironmentError extends Error {
  constructor(name: string, reason: string) {
    super(`Invalid environment variable ${name}: ${reason}`)
    this.name = 'EnvironmentError'
  }
}

/**
 * Normalises an origin-or-prefix URL.
 *
 * Accepts `''` (relative, same-origin) and any absolute `http`/`https` URL. Returns the
 * value with every trailing slash removed, because every caller concatenates a path that
 * already begins with `/` — `${base}/v1/...` must not become `//v1/...`.
 */
function readUrl(name: string, raw: string | undefined): string {
  const value = (raw ?? '').trim()
  if (!value) return ''

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new EnvironmentError(
      name,
      `expected an absolute URL such as https://api.example.com (received "${value}")`,
    )
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new EnvironmentError(name, `expected http: or https:, received ${parsed.protocol}`)
  }

  return value.replace(/\/+$/, '')
}

/** Digits only, country code first, no `+` — the shape wa.me and `tel:` both need. */
function readDigits(raw: string | undefined): string {
  return (raw ?? '').replace(/\D/g, '')
}

function readText(raw: string | undefined): string {
  return (raw ?? '').trim()
}

export type PublicEnv = {
  /**
   * Origin the Django API is served from, or `''` for same-origin relative requests.
   *
   * `''` is the local-development default: `next.config.ts` turns on a `/v1/:path*`
   * rewrite only when this IS set, which is the Next equivalent of the Vite dev proxy.
   */
  apiBaseUrl: string
  /** Canonical public origin, used for `metadataBase`. `''` disables absolute metadata URLs. */
  siteUrl: string
  /** Google OAuth 2.0 **Web application client ID**. Public by design. Never the secret. */
  googleClientId: string
  /** WhatsApp / click-to-call number. Digits only. */
  whatsAppNumber: string
  /** Full Instagram profile URL, or `''` to use the in-code default. */
  instagramUrl: string
  /** Support inbox override, or `''` to use the in-code default. */
  supportEmail: string
}

export const env: PublicEnv = {
  apiBaseUrl: readUrl('NEXT_PUBLIC_API_BASE_URL', process.env.NEXT_PUBLIC_API_BASE_URL),
  siteUrl: readUrl('NEXT_PUBLIC_SITE_URL', process.env.NEXT_PUBLIC_SITE_URL),
  googleClientId: readText(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
  whatsAppNumber: readDigits(process.env.NEXT_PUBLIC_WHATSAPP_NUMBER),
  instagramUrl: readText(process.env.NEXT_PUBLIC_INSTAGRAM_URL),
  supportEmail: readText(process.env.NEXT_PUBLIC_SUPPORT_EMAIL),
}

/**
 * Which optional variables are configured — booleans only, never the values.
 *
 * Used by `/migration-status` so the page can report readiness without printing a client
 * ID or an origin onto a page that might be shared in a screenshot.
 */
export function envReadiness(): { name: string; configured: boolean; required: string }[] {
  return [
    { name: 'NEXT_PUBLIC_API_BASE_URL', configured: env.apiBaseUrl !== '', required: 'Phase 4' },
    { name: 'NEXT_PUBLIC_SITE_URL', configured: env.siteUrl !== '', required: 'Phase 7' },
    { name: 'NEXT_PUBLIC_GOOGLE_CLIENT_ID', configured: env.googleClientId !== '', required: 'Phase 4' },
    { name: 'NEXT_PUBLIC_WHATSAPP_NUMBER', configured: env.whatsAppNumber !== '', required: 'optional' },
    { name: 'NEXT_PUBLIC_INSTAGRAM_URL', configured: env.instagramUrl !== '', required: 'optional' },
    { name: 'NEXT_PUBLIC_SUPPORT_EMAIL', configured: env.supportEmail !== '', required: 'optional' },
  ]
}
