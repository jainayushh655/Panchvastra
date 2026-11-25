'use client'

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthProvider'
import { BackendImage } from '@/components/BackendImage'
import { SizeChart } from '@/components/product/SizeChart'
import { getSizeChart } from '@/lib/sizeChart'
import { hasNoCustomOptions } from '@/lib/customOptions'
import {
  createCustomRequest,
  fetchCustomOptions,
  isUnauthenticated,
  readCustomRequestApiError,
  readCustomRequestFieldErrors,
} from '@/services/customRequests'
import {
  DEFAULT_PHONE_COUNTRY_CODE,
  DESIGN_DESCRIPTION_MAX,
  DESIGN_FILE_ACCEPT,
  DESIGN_FILE_MAX_BYTES,
  DESIGN_FILE_MIME,
  FULL_NAME_MAX,
  PHONE_COUNTRY_CODE_MAX,
  PHONE_NUMBER_MAX,
} from '@/types/api/CustomPieceDto'
import type { ColourDto, CustomOptionsDto } from '@/types/api/CustomPieceDto'

/**
 * Custom Piece — the "design your own" builder, ported from the Vite
 * `src/pages/CustomPiecePage.tsx`.
 *
 * Every choice is rendered from `GET /v1/custom_options/` in the order the API returns it.
 * No option name, id or count is hardcoded: adding a garment in the admin panel puts it on
 * this page with no deploy.
 *
 * The page is PUBLIC so the builder can be explored signed out; only the SUBMISSION needs a
 * session, which is what the contract specifies. That is unchanged from Vite.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A CLIENT COMPONENT, AND WHAT STAYED ON THE SERVER
 * ──────────────────────────────────────────────────────────────────────────────
 * Six interdependent fields, a drag-and-drop file picker, a size-chart dialog and a
 * multipart upload: all of it is interaction, so the form itself has to run in the browser.
 *
 * What does NOT need the browser is handed in as already-rendered markup. `masthead` and
 * `aside` are Server Components passed as props from `page.tsx` — React keeps them
 * server-rendered, so the headline, the four promises and the WhatsApp link cost no client
 * JavaScript even though they sit inside this component's grid. They are props rather than
 * markup here because the Vite layout puts them in the SAME grid as step cards 01 and 02
 * (the rail spans both rows), and splitting that grid to move them out would change the
 * desktop layout. The "How it works" strip, which sits outside the form, is rendered
 * directly by the page.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHERE THE OPTIONS COME FROM
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite page mounts empty, fires `GET /v1/custom_options/` from a `useEffect`, and paints
 * "Loading options…" until it lands. Here the page reads them on the SERVER
 * (`getCustomPieceOptions`), so the real garments, colours, sizes and print types are in the
 * first paint with no loading flash and no layout shift — and the read is anonymous by
 * construction, which this endpoint requires because it changes its response for a
 * privileged token.
 *
 * `initialOptions` being empty is the one case the server read cannot cover: a page
 * prerendered before the API was reachable. Then, and only then, this component falls back
 * to the Vite code path and re-reads the endpoint from the browser through `publicApi`. So
 * the common case makes no request at all, and the degraded case behaves exactly as the
 * Vite page always has, including its wording.
 */

/** Per-tab draft store. Never a URL, so nothing typed here is exposed in history or logs. */
const DRAFT_KEY = 'pv_custom_piece_draft_v1'

/** How long the confirmation stays on screen before the form returns to its resting state. */
const SUCCESS_VISIBLE_MS = 5000

/** The Vite page's own wording for a failed options read. */
const OPTIONS_LOAD_ERROR = 'We could not load the options right now. Please refresh and try again.'

type Draft = {
  garmentId: number | null
  colourId: number | null
  sizeId: number | null
  printTypeId: number | null
  description: string
  fullName: string
  countryCode: string
  phone: string
}

const EMPTY: Draft = {
  garmentId: null,
  colourId: null,
  sizeId: null,
  printTypeId: null,
  description: '',
  fullName: '',
  countryCode: DEFAULT_PHONE_COUNTRY_CODE,
  phone: '',
}

/**
 * The draft survives the login round trip through `sessionStorage`.
 *
 * The chosen FILE deliberately does not: a File cannot be serialized, and stashing its
 * bytes anywhere to survive a navigation would mean writing someone's artwork into browser
 * storage. The page says so in as many words when it restores a draft.
 */
function saveDraft(draft: Draft) {
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // A private window or full quota just means the draft is not restored. Not fatal.
  }
}

function takeDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    window.sessionStorage.removeItem(DRAFT_KEY)
    const parsed = JSON.parse(raw) as Partial<Draft>
    if (!parsed || typeof parsed !== 'object') return null
    return { ...EMPTY, ...parsed }
  } catch {
    return null
  }
}

/**
 * The size chart for a garment, reusing the product resolver rather than adding chart data.
 *
 * That module is deliberately strict — it returns null instead of guessing — so a garment
 * whose name matches nothing simply gets no Size Guide link, never the wrong measurements.
 */
function chartForGarment(name: string | null | undefined) {
  const n = (name ?? '').toLowerCase()
  if (!n) return null
  if (n.includes('short')) return getSizeChart('Shorts', null)
  if (n.includes('hoodie') || n.includes('sweatshirt')) return getSizeChart('Hoodie', null)
  if (n.includes('oversize')) return getSizeChart('T-Shirts', 'Oversized')
  if (n.includes('polo') || n.includes('full sleeve')) return getSizeChart('T-Shirts', 'Polo')
  if (n.includes('regular') || n.includes('t-shirt') || n.includes('tshirt')) {
    return getSizeChart('T-Shirts', 'Regular Fit')
  }
  return null
}

/* ------------------------------------------------------------------------ sanitisers */

/**
 * Keeps a typed value to the characters its field can actually hold, as it is typed.
 *
 * Filtering on the way in rather than only complaining on submit means a name can never
 * end up as "7777777777aDADD" and a phone number can never carry letters — which the
 * backend would reject anyway, after a round trip.
 *
 * `\p{L}` with the `u` flag, not `[A-Za-z]`: names here are not all Latin, and an ASCII
 * range would quietly delete every character of a name written in Devanagari.
 */
const sanitizeName = (value: string, max: number) =>
  value.replace(/[^\p{L}\p{M}\s'’.-]/gu, '').replace(/\s{2,}/g, ' ').replace(/^\s+/, '').slice(0, max)

/**
 * Digits only, capped AFTER stripping.
 *
 * The cap belongs here rather than on the input's `maxLength`, because `maxLength` counts
 * the raw text. Pasting "+91 (98765) 43210" is 17 characters, so the browser would cut it
 * to 15 before any of the punctuation was removed — and the number would silently lose its
 * last digits. Stripping first and capping second keeps a pasted, formatted number intact.
 */
const sanitizeDigits = (value: string, max?: number) => {
  const digits = value.replace(/\D/g, '')
  return max === undefined ? digits : digits.slice(0, max)
}

/** A dialling code is a leading `+` and digits, nothing else. */
const sanitizeCountryCode = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  return `+${digits}`
}

/**
 * How many digits a subscriber number may have, by dialling code.
 *
 * India is exactly ten, so `+91` is held to that — both as a typing cap and as a
 * validation rule. Every other code falls back to the ITU range of 7–15, which is also
 * the contract's own maximum for the field. Only the one code the store actually sells
 * into is special-cased: inventing a length table for the rest of the world would mean
 * guessing, and a wrong guess would block a legitimate number.
 */
const INDIA_DIALLING_CODE = '91'
const PHONE_MIN_DIGITS = 7

const phoneRules = (countryCode: string) =>
  sanitizeDigits(countryCode) === INDIA_DIALLING_CODE
    ? { min: 10, max: 10 }
    : { min: PHONE_MIN_DIGITS, max: PHONE_NUMBER_MAX }

/* ----------------------------------------------------------------------------- icons */

const S = { fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' } as const

const IconCheck = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="12" cy="12" r="12" />
    <path d="m7 12.5 3.2 3.2L17 9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconInfo = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
    <path d="M12 11v5M12 7.6v.6" strokeWidth={1.8} strokeLinecap="round" />
  </svg>
)
const IconUpload = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <path d="M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" strokeWidth={1.7} strokeLinecap="round" />
  </svg>
)
const IconUser = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <circle cx="12" cy="8" r="3.5" strokeWidth={1.6} />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeWidth={1.6} strokeLinecap="round" />
  </svg>
)
const IconPhone = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <path
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.5 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.1 6.1l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"
    />
  </svg>
)
const IconRuler = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <rect x="3" y="8.5" width="18" height="7" rx="1.5" strokeWidth={1.5} />
    <path d="M7 8.5v3M11 8.5v4M15 8.5v3M19 8.5v4" strokeWidth={1.4} strokeLinecap="round" />
  </svg>
)
const IconArrowRight = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16m0 0-6-6m6 6-6 6" />
  </svg>
)

/* ------------------------------------------------------------------- shared fragments */

/** The step-card frame. */
const CARD = 'rounded-2xl border border-soft-beige bg-white p-5 sm:p-6'

const INPUT =
  'w-full rounded-xl border border-soft-beige bg-white py-3 pl-11 pr-3.5 text-sm text-black outline-none transition-colors placeholder:text-zinc-400 focus:border-black disabled:cursor-not-allowed disabled:opacity-60'

/** The numbered header every step card carries. */
function StepHead({ step, title, hint }: { step: string; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-4">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-soft-beige text-xs font-bold tracking-wide text-zinc-700"
        aria-hidden
      >
        {step}
      </span>
      <div className="min-w-0">
        <h2 className="font-sans text-sm font-bold uppercase tracking-[0.08em] text-black sm:text-base">{title}</h2>
        <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">{hint}</p>
      </div>
    </div>
  )
}

/**
 * An option's artwork, with a neutral stand-in for an `image_url` of null.
 *
 * THE ONE CHANGE from the Vite version: `<img>` became `next/image` through
 * `BackendImage`, the convention every other backend-served image in this app already
 * follows. `next/image` with `fill` needs a positioned box, so the wrapper carries the
 * sizing classes the Vite `<img>` carried and the image fills it — the rendered box is the
 * same size either way, so no layout shift is introduced. `sizes` is given explicitly
 * because a `fill` image has no intrinsic width to infer it from.
 */
function OptionArt({
  src,
  name,
  boxClassName,
  fit,
  sizes,
}: {
  src: string | null
  name: string
  boxClassName: string
  fit: 'contain' | 'cover'
  sizes: string
}) {
  if (src) {
    return (
      <span className={`relative block overflow-hidden ${boxClassName}`}>
        <BackendImage
          src={src}
          alt=""
          fill
          sizes={sizes}
          loading="lazy"
          className={fit === 'contain' ? 'object-contain' : 'object-cover'}
        />
      </span>
    )
  }
  return (
    <span className={`flex items-center justify-center bg-cream ${boxClassName}`} aria-hidden>
      <span className="font-display text-2xl font-bold text-sand">{name.slice(0, 1).toUpperCase()}</span>
    </span>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1.5 text-xs font-semibold text-red-600" role="alert">
      {message}
    </p>
  )
}

/** Maps a draft key to the API field its error arrives under, so typing clears the right one. */
const FIELD_TO_API: Partial<Record<keyof Draft, string>> = {
  garmentId: 'garment_id',
  colourId: 'colour_id',
  sizeId: 'size_id',
  printTypeId: 'print_type_id',
  description: 'design_description',
  fullName: 'full_name',
  countryCode: 'phone_country_code',
  phone: 'phone_number',
}

/** Every API field name this form renders an error slot for. */
const PLACED_FIELDS = new Set([
  'garment_id',
  'colour_id',
  'size_id',
  'print_type_id',
  'design_description',
  'design_file',
  'full_name',
  'phone_country_code',
  'phone_number',
])

/**
 * Backend field errors for inputs this form does not have, as one banner line.
 *
 * Without this a 400 keyed on something unexpected would attach an error to nothing: the
 * shopper would see the form refuse to go through with no visible reason, and no way to
 * clear it. Surfacing the stray keys instead keeps the form usable and tells them what the
 * backend objected to.
 */
function unplacedFieldError(fields: Record<string, string>): string | null {
  const parts = Object.entries(fields)
    .filter(([field]) => !PLACED_FIELDS.has(field))
    .map(([field, text]) => (field === 'detail' || field === 'non_field_errors' ? text : `${field}: ${text}`))
  return parts.length ? parts.join(' ') : null
}

export function CustomPieceBuilder({
  initialOptions,
  masthead,
  aside,
}: {
  initialOptions: CustomOptionsDto
  masthead: ReactNode
  aside: ReactNode
}) {
  const router = useRouter()
  const { isAuthenticated } = useAuth()

  /*
   * Seeded from the server read, so the common case renders the real choices immediately
   * and never enters a loading state. `null` would mean "nothing to show yet", which is
   * only true when the server handed over an empty set.
   */
  const emptyOnArrival = hasNoCustomOptions(initialOptions)
  const [options, setOptions] = useState<CustomOptionsDto | null>(emptyOnArrival ? null : initialOptions)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [restored, setRestored] = useState(false)
  const [sending, setSending] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [chartOpen, setChartOpen] = useState(false)
  /** Synchronous guard — state is not applied immediately, so a double click could double-post. */
  const inFlight = useRef(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const ids = useId()
  const fid = (n: string) => `${ids}-${n}`
  const errId = (n: string) => `${ids}-${n}-error`

  /*
   * The browser fallback, and the only request this component makes before a submission.
   *
   * It runs ONLY when the server handed over nothing — see the header note. `emptyOnArrival`
   * is computed from a prop that does not change for the life of the mount, so this cannot
   * loop, and the guard means a healthy page issues no request at all.
   */
  useEffect(() => {
    if (!emptyOnArrival) return
    let active = true
    fetchCustomOptions()
      .then((data) => {
        if (!active) return
        setOptions(data)
        setLoadError(null)
      })
      .catch(() => {
        if (!active) return
        setOptions(null)
        setLoadError(OPTIONS_LOAD_ERROR)
      })
    return () => {
      active = false
    }
  }, [emptyOnArrival])

  /*
   * The confirmation is transient: it shows for five seconds and then clears itself,
   * leaving the already-emptied form at rest. The timer is torn down when the banner
   * changes or the page unmounts, so it can never fire against a later submission.
   */
  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(null), SUCCESS_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [success])

  /** A draft parked before the login redirect is picked up once, on the way back. */
  useEffect(() => {
    const saved = takeDraft()
    if (saved) {
      setDraft(saved)
      setRestored(true)
    }
  }, [])

  const garments = options?.garments ?? []
  const sizes = options?.sizes ?? []
  const printTypes = options?.print_types ?? []

  const selectedGarment = useMemo(
    () => (options?.garments ?? []).find((g) => g.id === draft.garmentId) ?? null,
    [options, draft.garmentId],
  )

  /**
   * Only the colours this garment can actually be ordered in — `colour_ids` is how the
   * backend expresses "Hoodie comes in Black only". Keeps the API's own colour order.
   */
  const availableColours = useMemo<ColourDto[]>(() => {
    const all = options?.colours ?? []
    if (!selectedGarment) return all
    const allowed = new Set(selectedGarment.colour_ids)
    return all.filter((c) => allowed.has(c.id))
  }, [options, selectedGarment])

  /*
   * Changing the garment can strip the chosen colour. Rather than submitting a pair the
   * backend would reject, the selection is corrected: kept when still offered, moved to the
   * only option when there is one, otherwise cleared so the shopper picks again.
   */
  useEffect(() => {
    if (!selectedGarment) return
    setDraft((current) => {
      if (current.colourId && availableColours.some((c) => c.id === current.colourId)) return current
      const next = availableColours.length === 1 ? availableColours[0].id : null
      if (next === current.colourId) return current
      return { ...current, colourId: next }
    })
  }, [selectedGarment, availableColours])

  const sizeChart = useMemo(() => chartForGarment(selectedGarment?.name), [selectedGarment])

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      const apiKey = FIELD_TO_API[key]
      if (!apiKey || !current[apiKey]) return current
      const next = { ...current }
      delete next[apiKey]
      return next
    })
  }

  /**
   * Changing the dialling code can change how long the number may be, so the number is
   * re-trimmed to the new code's limit in the same update. Switching to +91 with fifteen
   * digits already typed leaves ten, rather than a value that would only fail on submit.
   */
  const setCountryCode = (raw: string) => {
    const countryCode = sanitizeCountryCode(raw)
    setDraft((current) => ({
      ...current,
      countryCode,
      phone: sanitizeDigits(current.phone, phoneRules(countryCode).max),
    }))
    setFieldErrors((current) => {
      if (!current.phone_country_code && !current.phone_number) return current
      const next = { ...current }
      delete next.phone_country_code
      delete next.phone_number
      return next
    })
  }

  /** Checks the file the same way the backend does, so a bad pick costs no round trip. */
  const onPickFile = (picked: File | null) => {
    setFileError(null)
    if (!picked) {
      setFile(null)
      return
    }
    if (!DESIGN_FILE_MIME.includes(picked.type)) {
      setFile(null)
      setFileError('Upload a PNG, JPG or PDF file.')
      return
    }
    if (picked.size > DESIGN_FILE_MAX_BYTES) {
      setFile(null)
      setFileError('That file is over 10 MB. Please upload a smaller one.')
      return
    }
    setFile(picked)
  }

  const validate = (): Record<string, string> => {
    const errors: Record<string, string> = {}
    if (!draft.garmentId) errors.garment_id = 'Choose a garment.'
    if (!draft.colourId) errors.colour_id = 'Choose a colour.'
    if (!draft.sizeId) errors.size_id = 'Choose a size.'
    if (!draft.printTypeId) errors.print_type_id = 'Choose a print type.'
    if (!draft.fullName.trim()) errors.full_name = 'Please enter your full name.'
    else if (!/\p{L}/u.test(draft.fullName)) errors.full_name = 'Please enter your name in letters.'

    const code = sanitizeDigits(draft.countryCode)
    if (!code) errors.phone_country_code = 'Required.'

    const digits = sanitizeDigits(draft.phone)
    const { min, max } = phoneRules(draft.countryCode)
    if (!digits) errors.phone_number = 'Please enter your phone number.'
    else if (min === max && digits.length !== min) errors.phone_number = `Enter a ${min}-digit phone number.`
    else if (digits.length < min) errors.phone_number = 'That phone number looks too short.'
    else if (digits.length > max) errors.phone_number = 'That phone number looks too long.'
    if (draft.description.length > DESIGN_DESCRIPTION_MAX) {
      errors.design_description = `Keep this under ${DESIGN_DESCRIPTION_MAX} characters.`
    }
    return errors
  }

  /**
   * Sends a signed-out shopper to sign in, carrying where to come back to.
   *
   * The Vite page passes the return path through react-router's `location.state`
   * (`navigate('/login', { state: { from: '/custom-piece' } })`). The App Router has no
   * equivalent, so it travels as `?next=` — the convention the product page and
   * `ProtectedRoute` already established, and which the login page reads through
   * `safeNextPath`.
   *
   * The path is read from `window.location` rather than `usePathname`/`useSearchParams` for
   * the reason `ProtectedRoute` records: `useSearchParams()` forces a statically prerendered
   * route to be client-rendered and fails the build without a Suspense boundary, and this
   * value is only ever needed inside a browser-only handler anyway.
   */
  const goSignIn = () => {
    const here = `${window.location.pathname}${window.location.search}`
    router.push(`/login?next=${encodeURIComponent(here)}`)
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current || sending) return

    const invalid = validate()
    // The contract requires a file, a description, or both — never neither.
    const needsDesign = !file && !draft.description.trim()
    if (needsDesign) setFileError('Upload a design file or describe your design.')

    if (Object.keys(invalid).length > 0 || needsDesign || fileError) {
      setFieldErrors(invalid)
      setFormError(null)
      setSuccess(null)
      return
    }

    /*
     * Submission needs a session. The draft is parked first so the shopper comes back to
     * everything they had chosen, then the app's own login convention carries the return
     * path.
     */
    if (!isAuthenticated) {
      saveDraft(draft)
      goSignIn()
      return
    }

    inFlight.current = true
    setSending(true)
    setFieldErrors({})
    setFormError(null)
    setSuccess(null)

    try {
      const message = await createCustomRequest({
        garment_id: draft.garmentId!,
        colour_id: draft.colourId!,
        size_id: draft.sizeId!,
        print_type_id: draft.printTypeId!,
        design_file: file,
        design_description: draft.description,
        full_name: draft.fullName.trim(),
        phone_country_code: draft.countryCode.trim(),
        phone_number: draft.phone.trim(),
      })
      // Only a confirmed success resets anything.
      setDraft(EMPTY)
      setFile(null)
      setFileError(null)
      setRestored(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
      setSuccess(message)
    } catch (error) {
      if (isUnauthenticated(error)) {
        saveDraft(draft)
        goSignIn()
        return
      }
      const fields = readCustomRequestFieldErrors(error)
      if (Object.keys(fields).length > 0) {
        setFieldErrors(fields)
        // Anything keyed on an input this form does not render still has to be visible.
        setFormError(unplacedFieldError(fields))
      } else {
        setFormError(readCustomRequestApiError(error))
      }
      // Nothing the shopper entered is cleared on failure.
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  const described = (key: string) => (fieldErrors[key] ? errId(key) : undefined)

  return (
    <>
      {loadError ? (
        <p className="rounded-xl border border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
          {loadError}
        </p>
      ) : null}

      {!options && !loadError ? <p className="text-sm text-zinc-500">Loading options…</p> : null}

      {options ? (
        <form onSubmit={onSubmit} noValidate>
          {/* ============ masthead + the promises rail beside it ============ */}
          {/* Explicit rows so the rail spans both of them on desktop while the two
              first step cards sit beneath the masthead in column one. On a phone the
              grid collapses to source order — masthead, rail, then the steps — which
              keeps the numbered sequence unbroken instead of dropping the rail
              between step 02 and step 03. */}
          <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-x-10 lg:gap-y-8">
            {/* Both of these are server-rendered markup handed in as props. */}
            {masthead}
            {aside}

            <div className="min-w-0 space-y-4 lg:col-start-1 lg:row-start-2">
              {/* ---- 01 garment ---- */}
              <fieldset className={CARD}>
                <legend className="sr-only">Choose your garment</legend>
                <StepHead step="01" title="Choose Your Garment" hint="Pick the style you want to customize." />
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {garments.map((g) => {
                    const on = draft.garmentId === g.id
                    return (
                      <label
                        key={g.id}
                        className={`relative flex cursor-pointer flex-col items-center rounded-xl border p-3 transition-colors ${
                          on ? 'border-burgundy bg-cream' : 'border-soft-beige bg-cream hover:border-sand'
                        }`}
                      >
                        <input
                          type="radio"
                          name="garment"
                          value={g.id}
                          checked={on}
                          onChange={() => set('garmentId', g.id)}
                          className="sr-only"
                        />
                        {on ? <IconCheck className="absolute right-2.5 top-2.5 size-5 text-black" /> : null}
                        <OptionArt
                          src={g.image_url}
                          name={g.name}
                          boxClassName="h-32 w-full rounded-lg"
                          fit="contain"
                          sizes="(min-width: 1024px) 220px, (min-width: 640px) 45vw, 90vw"
                        />
                        <span className={`mt-3 text-sm ${on ? 'font-bold text-black' : 'font-medium text-zinc-700'}`}>
                          {g.name}
                        </span>
                      </label>
                    )
                  })}
                </div>
                <FieldError id={errId('garment_id')} message={fieldErrors.garment_id} />
              </fieldset>

              {/* ---- 02 colour ---- */}
              <fieldset className={CARD}>
                <legend className="sr-only">Choose colour</legend>
                <StepHead step="02" title="Choose Colour" hint="Pick your favourite colour." />
                <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8">
                  <div className="flex flex-wrap items-start gap-5">
                    {availableColours.map((c) => {
                      const on = draft.colourId === c.id
                      return (
                        <label key={c.id} className="flex cursor-pointer flex-col items-center gap-2">
                          <input
                            type="radio"
                            name="colour"
                            value={c.id}
                            checked={on}
                            onChange={() => set('colourId', c.id)}
                            className="sr-only"
                          />
                          <span className="relative block">
                            <span
                              className={`block size-12 rounded-full border transition-colors ${
                                on ? 'border-burgundy' : 'border-sand'
                              }`}
                              style={c.hex_code ? { backgroundColor: c.hex_code } : undefined}
                            />
                            {on ? <IconCheck className="absolute -bottom-0.5 -right-0.5 size-5 text-black" /> : null}
                          </span>
                          <span className={`text-xs ${on ? 'font-bold text-black' : 'text-zinc-600'}`}>{c.name}</span>
                        </label>
                      )
                    })}
                  </div>

                  {/* The note the contract calls for: this garment has exactly one colour. */}
                  {selectedGarment && availableColours.length === 1 ? (
                    <div className="flex items-start gap-3 sm:border-l sm:border-soft-beige sm:pl-8">
                      <IconInfo className="size-5 shrink-0 text-zinc-400" />
                      <p className="text-sm leading-snug text-zinc-600">
                        {selectedGarment.name} is available only in {availableColours[0].name}.
                      </p>
                    </div>
                  ) : null}
                  {selectedGarment && availableColours.length === 0 ? (
                    <div className="flex items-start gap-3 sm:border-l sm:border-soft-beige sm:pl-8">
                      <IconInfo className="size-5 shrink-0 text-red-500" />
                      <p className="text-sm leading-snug font-semibold text-red-600" role="alert">
                        {selectedGarment.name} has no colours available right now. Please choose another garment.
                      </p>
                    </div>
                  ) : null}
                </div>
                <FieldError id={errId('colour_id')} message={fieldErrors.colour_id} />
              </fieldset>
            </div>
          </div>

          {/* ============ the remaining steps, full width ============ */}
          <div className="mt-4 space-y-4">
            {/* ---- 03 size ---- */}
            <fieldset className={CARD}>
              <legend className="sr-only">Select size</legend>
              <StepHead step="03" title="Select Size" hint="Choose your size." />
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="flex flex-1 flex-wrap gap-3">
                  {sizes.map((s) => {
                    const on = draft.sizeId === s.id
                    return (
                      <label
                        key={s.id}
                        className={`min-w-[62px] cursor-pointer rounded-xl border px-5 py-3 text-center text-sm font-bold transition-colors ${
                          on ? 'border-burgundy bg-cream text-espresso' : 'border-soft-beige bg-cream text-zinc-600 hover:border-sand'
                        }`}
                      >
                        <input
                          type="radio"
                          name="size"
                          value={s.id}
                          checked={on}
                          onChange={() => set('sizeId', s.id)}
                          className="sr-only"
                        />
                        {s.name}
                      </label>
                    )
                  })}
                </div>
                {/* Only offered when the garment resolves to a real chart — never a guess. */}
                {sizeChart ? (
                  <button
                    type="button"
                    onClick={() => setChartOpen(true)}
                    className="inline-flex items-center gap-2 text-sm font-semibold text-black underline underline-offset-4"
                  >
                    <IconRuler className="size-5" />
                    Size Guide
                  </button>
                ) : null}
              </div>
              <FieldError id={errId('size_id')} message={fieldErrors.size_id} />
            </fieldset>

            {/* ---- 04 print type ---- */}
            <fieldset className={CARD}>
              <legend className="sr-only">Choose printing type</legend>
              <StepHead step="04" title="Choose Printing Type" hint="Select how you want your design to be made." />
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {printTypes.map((p) => {
                  const on = draft.printTypeId === p.id
                  return (
                    <label
                      key={p.id}
                      className={`relative flex cursor-pointer items-stretch gap-4 overflow-hidden rounded-xl border transition-colors ${
                        on ? 'border-burgundy bg-cream' : 'border-soft-beige bg-cream hover:border-sand'
                      }`}
                    >
                      <input
                        type="radio"
                        name="print_type"
                        value={p.id}
                        checked={on}
                        onChange={() => set('printTypeId', p.id)}
                        className="sr-only"
                      />
                      <OptionArt
                        src={p.image_url}
                        name={p.name}
                        boxClassName="w-32 shrink-0 self-stretch"
                        fit="cover"
                        sizes="128px"
                      />
                      <span className="min-w-0 flex-1 py-4 pr-10">
                        <span className="block font-sans text-sm font-bold uppercase tracking-[0.06em] text-black">
                          {p.name}
                        </span>
                        {p.description ? (
                          <span className="mt-1.5 block text-xs leading-relaxed text-zinc-500">{p.description}</span>
                        ) : null}
                      </span>
                      <span className="absolute right-3 top-4">
                        {on ? (
                          <IconCheck className="size-5 text-black" />
                        ) : (
                          <span className="block size-5 rounded-full border border-sand" aria-hidden />
                        )}
                      </span>
                    </label>
                  )
                })}
              </div>
              <FieldError id={errId('print_type_id')} message={fieldErrors.print_type_id} />
            </fieldset>

            {/* ---- 05 design ---- */}
            <div className={CARD}>
              <StepHead step="05" title="Upload Your Design" hint="Upload your artwork or tell us what you're imagining." />
              <div className="mt-5 grid grid-cols-1 items-stretch gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                {/*
                  The drop zone is a <label> bound to the real file input, so it is
                  keyboard-reachable and screen-reader-announced as the file control it is
                  — not a div with a click handler.
                */}
                <label
                  htmlFor={fid('file')}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragging(true)
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragging(false)
                    onPickFile(e.dataTransfer.files?.[0] ?? null)
                  }}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
                    dragging ? 'border-black bg-cream' : 'border-sand bg-cream hover:border-zinc-400'
                  }`}
                >
                  <IconUpload className="size-7 text-black" />
                  <span className="mt-3 block text-sm font-bold text-black">
                    {file ? file.name : 'Drop your design here'}
                  </span>
                  {!file ? <span className="block text-sm font-bold text-black">or click to upload</span> : null}
                  <span className="mt-2 block text-xs text-zinc-500">PNG / JPG / PDF (Max 10MB)</span>
                </label>
                <input
                  id={fid('file')}
                  ref={fileInputRef}
                  type="file"
                  name="design_file"
                  accept={DESIGN_FILE_ACCEPT}
                  disabled={sending}
                  onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                  aria-describedby={fileError ? errId('design_file') : undefined}
                  className="sr-only"
                />

                <div className="flex items-center justify-center lg:flex-col">
                  <span className="hidden h-full w-px flex-1 bg-soft-beige lg:block" aria-hidden />
                  <span className="px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-400">or</span>
                  <span className="hidden h-full w-px flex-1 bg-soft-beige lg:block" aria-hidden />
                </div>

                <div className="rounded-xl bg-cream p-4">
                  <label htmlFor={fid('description')} className="block text-sm font-bold text-black">
                    Don&rsquo;t have a design?
                  </label>
                  <p className="mt-0.5 text-xs text-zinc-500">Tell us your idea and we&rsquo;ll help bring it to life.</p>
                  <textarea
                    id={fid('description')}
                    name="design_description"
                    rows={3}
                    value={draft.description}
                    maxLength={DESIGN_DESCRIPTION_MAX}
                    disabled={sending}
                    onChange={(e) => set('description', e.target.value)}
                    aria-invalid={Boolean(fieldErrors.design_description)}
                    aria-describedby={described('design_description')}
                    placeholder="Describe your design…"
                    className="mt-3 w-full resize-y rounded-lg border border-soft-beige bg-white px-3.5 py-2.5 text-sm text-black outline-none transition-colors placeholder:text-zinc-400 focus:border-black disabled:opacity-60"
                  />
                  <div className="mt-1 flex items-start justify-between gap-3">
                    <span className="min-w-0 flex-1">
                      <FieldError id={errId('design_description')} message={fieldErrors.design_description} />
                    </span>
                    <span className="shrink-0 text-[11px] tabular-nums text-zinc-500" aria-live="polite">
                      {draft.description.length}/{DESIGN_DESCRIPTION_MAX}
                    </span>
                  </div>
                </div>
              </div>
              <FieldError id={errId('design_file')} message={fileError ?? fieldErrors.design_file} />
            </div>

            {/* ---- 06 details ---- */}
            <div className={CARD}>
              <StepHead step="06" title="Your Details" hint="We'll use this to confirm your design and keep you updated." />
              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={fid('name')} className="sr-only">
                    Full name
                  </label>
                  <div className="relative">
                    <IconUser className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-zinc-400" />
                    <input
                      id={fid('name')}
                      name="full_name"
                      type="text"
                      value={draft.fullName}
                      maxLength={FULL_NAME_MAX}
                      disabled={sending}
                      autoComplete="name"
                      onChange={(e) => set('fullName', sanitizeName(e.target.value, FULL_NAME_MAX))}
                      aria-invalid={Boolean(fieldErrors.full_name)}
                      aria-describedby={described('full_name')}
                      placeholder="Full Name"
                      className={`${INPUT} ${fieldErrors.full_name ? 'border-red-500 focus:border-red-600' : ''}`}
                    />
                  </div>
                  <FieldError id={errId('full_name')} message={fieldErrors.full_name} />
                </div>

                <div>
                  <label htmlFor={fid('phone')} className="sr-only">
                    Phone number
                  </label>
                  {/*
                    The icon is a real flex item, not absolutely positioned over a padded
                    input. With the old arrangement the code field had to reserve ~86px of
                    left padding for the icon, so "+91" was left-aligned in the middle of
                    nowhere and sat a long way from the number — clearest on a phone.
                    Laying the three parts out in a row, and right-aligning the code
                    against the divider, closes that gap at every width while still leaving
                    room for a four-digit dialling code.
                  */}
                  <div className="flex items-stretch rounded-xl border border-soft-beige bg-white focus-within:border-black">
                    <span className="flex shrink-0 items-center pl-3.5 pr-2 text-zinc-400" aria-hidden>
                      <IconPhone className="size-[18px]" />
                    </span>
                    <label htmlFor={fid('code')} className="sr-only">
                      Country code
                    </label>
                    <input
                      id={fid('code')}
                      name="phone_country_code"
                      type="text"
                      inputMode="tel"
                      value={draft.countryCode}
                      maxLength={PHONE_COUNTRY_CODE_MAX}
                      disabled={sending}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="w-[46px] shrink-0 grow-0 border-none bg-transparent py-3 pr-1.5 text-right text-sm text-black outline-none disabled:opacity-60"
                    />
                    <span className="my-2.5 w-px shrink-0 bg-soft-beige" aria-hidden />
                    <input
                      id={fid('phone')}
                      name="phone_number"
                      type="tel"
                      inputMode="numeric"
                      value={draft.phone}
                      disabled={sending}
                      autoComplete="tel-national"
                      // No `maxLength`: the 15-digit cap is applied by the sanitiser, after
                      // punctuation is stripped. See `sanitizeDigits`.
                      onChange={(e) => set('phone', sanitizeDigits(e.target.value, phoneRules(draft.countryCode).max))}
                      aria-invalid={Boolean(fieldErrors.phone_number)}
                      aria-describedby={described('phone_number')}
                      placeholder="Phone Number (WhatsApp)"
                      className="min-w-0 flex-1 border-none bg-transparent px-3 py-3 text-sm text-black outline-none placeholder:text-zinc-400 disabled:opacity-60"
                    />
                  </div>
                  <FieldError
                    id={errId('phone_number')}
                    message={fieldErrors.phone_number ?? fieldErrors.phone_country_code}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ============ submit ============ */}
          {restored ? (
            <p className="mt-5 rounded-xl border border-sand bg-white px-4 py-3 text-sm text-zinc-700" role="status">
              We kept your selections. Please choose your design file again — files are not carried across sign-in.
            </p>
          ) : null}

          {formError ? (
            <p
              className="mt-5 rounded-xl border border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              role="alert"
            >
              {formError}
            </p>
          ) : null}

          <div className="mt-6 flex justify-center">
            <button
              type="submit"
              disabled={sending}
              aria-busy={sending}
              className="inline-flex min-h-[52px] w-full max-w-xl items-center justify-center gap-3 rounded-xl bg-chocolate px-8 text-xs font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending ? 'Sending…' : 'Create My Piece'}
              {sending ? null : <IconArrowRight className="size-4" />}
            </button>
          </div>

          {/* The API's own confirmation, shown verbatim as plain text. */}
          {success ? (
            <p
              className="mt-5 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-3 text-center text-sm font-semibold whitespace-pre-wrap text-emerald-800"
              role="status"
            >
              {success}
            </p>
          ) : null}
        </form>
      ) : null}

      {sizeChart ? <SizeChart isOpen={chartOpen} onClose={() => setChartOpen(false)} chart={sizeChart} /> : null}
    </>
  )
}
