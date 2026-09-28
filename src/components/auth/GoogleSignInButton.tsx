import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * "Continue with Google", shared by the customer login and signup screens.
 *
 * Uses Google Identity Services directly rather than adding an OAuth wrapper package: the
 * whole integration is one script, one `initialize` and one `renderButton`, and the
 * project has no existing auth library to extend. Google's own `renderButton` is used
 * instead of a hand-rolled button because it ships the correct branding, an accessible
 * name, keyboard support and localisation for free.
 *
 * The component's only job is to hand the RAW `response.credential` to `onCredential`.
 * It never decodes the token and never reads the email, name or picture out of it —
 * everything the account is built from comes back from the backend, which verified it.
 */

const GSI_SRC = 'https://accounts.google.com/gsi/client'

/** Google's button caps at 400px; below ~200px it renders awkwardly. */
const MIN_BUTTON_WIDTH = 200
const MAX_BUTTON_WIDTH = 400

type CredentialResponse = { credential?: string }

type GoogleIdentity = {
  accounts: {
    id: {
      initialize: (config: {
        client_id: string
        callback: (response: CredentialResponse) => void
        cancel_on_tap_outside?: boolean
        auto_select?: boolean
      }) => void
      renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentity
  }
}

/**
 * Loads the Google script exactly once for the whole application.
 *
 * The promise is memoised at module scope, so mounting this button on Login and then on
 * Signup — or remounting it under StrictMode — reuses the same load instead of injecting
 * another <script>. An existing tag (from a future index.html include) is adopted rather
 * than duplicated.
 */
let gsiPromise: Promise<GoogleIdentity> | null = null

function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Identity Services needs a browser.'))
  }
  if (window.google?.accounts?.id) return Promise.resolve(window.google)
  if (gsiPromise) return gsiPromise

  gsiPromise = new Promise<GoogleIdentity>((resolve, reject) => {
    const settle = () => {
      if (window.google?.accounts?.id) resolve(window.google)
      else reject(new Error('Google Identity Services loaded without an accounts API.'))
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', settle, { once: true })
      existing.addEventListener('error', () => reject(new Error('Google script failed to load.')), { once: true })
      // Already finished loading before we attached the listener.
      if (window.google?.accounts?.id) settle()
      return
    }

    const script = document.createElement('script')
    script.src = GSI_SRC
    script.async = true
    script.defer = true
    script.addEventListener('load', settle, { once: true })
    script.addEventListener('error', () => {
      // Allow a later retry rather than caching the failure forever.
      gsiPromise = null
      reject(new Error('Google script failed to load.'))
    }, { once: true })
    document.head.appendChild(script)
  })

  return gsiPromise
}

export function GoogleSignInButton({
  onCredential,
  disabled = false,
  text = 'continue_with',
}: {
  /** Receives the raw Google ID token. Must perform the backend exchange. */
  onCredential: (credential: string) => void | Promise<void>
  disabled?: boolean
  text?: 'continue_with' | 'signin_with' | 'signup_with'
}) {
  /*
   * Public by design and expected in the bundle — never a client SECRET.
   *
   * Trimmed because a stray space around the value in a .env file would otherwise be sent
   * to Google as part of the client id and fail with a confusing origin/client error
   * rather than a clear "not configured".
   */
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || undefined

  const hostRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  /*
   * ONE click must produce ONE backend request — the endpoint rate-limits at 10/min/IP.
   * A ref, not state, because Google can fire the callback again before a state update has
   * been committed, and the guard has to be readable synchronously.
   */
  const inFlightRef = useRef(false)
  /** Keeps the latest handler reachable without re-initialising Google on every render. */
  const onCredentialRef = useRef(onCredential)
  useEffect(() => {
    onCredentialRef.current = onCredential
  }, [onCredential])

  const handleCredential = useCallback((response: CredentialResponse) => {
    const credential = response?.credential
    if (!credential) {
      setFailed(true)
      return
    }
    if (inFlightRef.current) return
    inFlightRef.current = true
    setBusy(true)

    void Promise.resolve(onCredentialRef.current(credential)).finally(() => {
      inFlightRef.current = false
      setBusy(false)
    })
  }, [])

  // Track the available width so Google's fixed-width button never overflows a phone.
  useEffect(() => {
    const host = hostRef.current
    if (!host || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width)
      setWidth((prev) => (Math.abs(prev - next) > 4 ? next : prev))
    })
    observer.observe(host)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!clientId || !hostRef.current || width === 0) return

    let cancelled = false
    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !hostRef.current) return
        google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          cancel_on_tap_outside: true,
          // No One Tap auto sign-in: the customer must actively choose Google.
          auto_select: false,
        })
        // Re-render replaces the previous button, so width changes never stack buttons.
        hostRef.current.innerHTML = ''
        google.accounts.id.renderButton(hostRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text,
          shape: 'rectangular',
          logo_alignment: 'center',
          width: Math.min(Math.max(width, MIN_BUTTON_WIDTH), MAX_BUTTON_WIDTH),
        })
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [clientId, handleCredential, text, width])

  // Without a client id there is nothing to render; the OTP form below still works, so the
  // screen degrades rather than breaking.
  if (!clientId) {
    return (
      <p className="text-sm text-zinc-500" role="status">
        Google sign-in is not configured.
      </p>
    )
  }

  return (
    <div className="w-full">
      {/*
        `min-w-0` lets this shrink inside a flex/grid parent; `overflow-hidden` keeps
        Google's fixed-pixel iframe from pushing the page wider on a narrow phone.
      */}
      <div
        ref={hostRef}
        className={`flex w-full min-w-0 justify-center overflow-hidden ${
          disabled || busy ? 'pointer-events-none opacity-60' : ''
        }`}
        aria-busy={busy || undefined}
      />

      {/* Announced politely so a screen reader hears the outcome without stealing focus. */}
      <p aria-live="polite" className="min-h-0">
        {failed ? (
          <span className="mt-2 block text-sm text-red-600">
            Google sign-in is unavailable right now. Please use your email below.
          </span>
        ) : null}
      </p>
    </div>
  )
}
