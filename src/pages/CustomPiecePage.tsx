import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { SizeChart } from '@/components/product/SizeChart'
import { getSizeChart } from '@/lib/sizeChart'
import { whatsAppPageUrl } from '@/lib/siteUrls'
import { getCustomOptions } from '@/api/customOptions'
import {
  createCustomRequest,
  isUnauthenticated,
  readCustomRequestApiError,
  readCustomRequestFieldErrors,
} from '@/api/customRequests'
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
 * Custom Piece — the customer-facing "design your own" builder.
 *
 * Every choice is rendered from `GET /v1/custom_options/` in the order the API returns it.
 * No option name, id or count is hardcoded: adding a garment in the admin panel puts it on
 * this page with no deploy.
 *
 * The page is PUBLIC so the builder can be explored signed out; only the submission needs a
 * session, which is what the contract specifies.
 */

/** Per-tab draft store. Never a URL, so nothing typed here is exposed in history or logs. */
const DRAFT_KEY = 'pv_custom_piece_draft_v1'

/** How long the confirmation stays on screen before the form returns to its resting state. */
const SUCCESS_VISIBLE_MS = 5000

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
const IconShield = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z" strokeWidth={1.5} strokeLinejoin="round" />
    <path d="m9 12 2.2 2.2L15.5 10" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const IconGear = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <circle cx="12" cy="12" r="3" strokeWidth={1.5} />
    <path
      strokeWidth={1.5}
      strokeLinejoin="round"
      d="M12 3.5l1.3 2.2 2.5-.5.5 2.5 2.2 1.3-1.4 2.1 1.4 2.1-2.2 1.3-.5 2.5-2.5-.5L12 20.5l-1.3-2.2-2.5.5-.5-2.5-2.2-1.3L4.9 13 3.5 10.9l2.2-1.3.5-2.5 2.5.5z"
    />
  </svg>
)
const IconTruck = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <path
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 6.75h10.5v8.5H3zM13.5 9.75H17l3 3v2.5h-6.5zM7.25 17.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5zM17.25 17.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5z"
    />
  </svg>
)
const IconBox = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <path d="M12 3.5 20 8v8l-8 4.5L4 16V8z" strokeWidth={1.5} strokeLinejoin="round" />
    <path d="M4 8l8 4.5L20 8M12 12.5V20.5" strokeWidth={1.5} strokeLinejoin="round" />
  </svg>
)
const IconBulb = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <path d="M9.5 17.5h5M10 20.5h4" strokeWidth={1.6} strokeLinecap="round" />
    <path d="M12 3.5a5.5 5.5 0 0 1 3.3 9.9c-.5.4-.8 1-.8 1.6v.5h-5v-.5c0-.6-.3-1.2-.8-1.6A5.5 5.5 0 0 1 12 3.5z" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
)
const IconChat = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <path d="M4.5 5.5h15v11h-8.5L6.5 20v-3.5h-2z" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
)
const IconCheckCircle = ({ className }: { className?: string }) => (
  <svg className={className} {...S} aria-hidden>
    <circle cx="12" cy="12" r="8.5" strokeWidth={1.6} />
    <path d="m8.3 12.2 2.5 2.5 4.9-5.2" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
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
/** The official WhatsApp mark — the same path the footer and Help Desk use. */
const IconWhatsApp = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
)

/* ------------------------------------------------------------------- shared fragments */

const CARD = 'rounded-2xl border border-[#ece6dc] bg-white p-5 sm:p-6'
const INPUT =
  'w-full rounded-xl border border-[#e4ddd2] bg-white py-3 pl-11 pr-3.5 text-sm text-black outline-none transition-colors placeholder:text-zinc-400 focus:border-black disabled:cursor-not-allowed disabled:opacity-60'

/** The numbered header every step card carries. */
function StepHead({ step, title, hint }: { step: string; title: string; hint: string }) {
  return (
    <div className="flex items-start gap-4">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#f3ece2] text-xs font-bold tracking-wide text-zinc-700"
        aria-hidden
      >
        {step}
      </span>
      <div className="min-w-0">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.08em] text-black sm:text-base">{title}</h2>
        <p className="mt-0.5 text-xs text-zinc-500 sm:text-sm">{hint}</p>
      </div>
    </div>
  )
}

/** Neutral stand-in for an option whose `image_url` is null. */
function OptionArt({ src, name, className }: { src: string | null; name: string; className?: string }) {
  if (src) return <img src={src} alt="" className={className} loading="lazy" />
  return (
    <span className={`flex items-center justify-center bg-[#f4f1ec] ${className ?? ''}`} aria-hidden>
      <span className="font-display text-2xl font-bold text-[#d8d0c4]">{name.slice(0, 1).toUpperCase()}</span>
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

const PROMISES = [
  { Icon: IconShield, label: 'Premium quality materials' },
  { Icon: IconGear, label: 'Made just for you' },
  { Icon: IconTruck, label: '5–7 business days' },
  { Icon: IconBox, label: 'Secure packaging' },
]

const HOW_IT_WORKS = [
  { Icon: IconBulb, step: '01', title: 'Create', copy: 'Upload your design or share your idea.' },
  { Icon: IconChat, step: '02', title: 'Review', copy: 'We refine and confirm it with you.' },
  { Icon: IconCheckCircle, step: '03', title: 'Approve', copy: 'Approve the final design.' },
  { Icon: IconGear, step: '04', title: 'Craft', copy: 'We bring it to life.' },
  { Icon: IconBox, step: '05', title: 'Deliver', copy: 'Your custom Panchvastra arrives at your doorstep.' },
]

export function CustomPiecePage() {
  useDocumentTitle('Custom Piece')
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()

  const [options, setOptions] = useState<CustomOptionsDto | null>(null)
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

  useEffect(() => {
    let active = true
    getCustomOptions()
      .then((data) => {
        if (!active) return
        setOptions(data)
        setLoadError(null)
      })
      .catch(() => {
        if (!active) return
        setOptions(null)
        setLoadError('We could not load the options right now. Please refresh and try again.')
      })
    return () => {
      active = false
    }
  }, [])

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
    if (!draft.countryCode.trim()) errors.phone_country_code = 'Required.'
    if (!draft.phone.trim()) errors.phone_number = 'Please enter your phone number.'
    if (draft.description.length > DESIGN_DESCRIPTION_MAX) {
      errors.design_description = `Keep this under ${DESIGN_DESCRIPTION_MAX} characters.`
    }
    return errors
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
     * everything they had chosen, then the app's own login guard convention carries the
     * return path — the same `state.from` the ProtectedRoute uses.
     */
    if (!isAuthenticated) {
      saveDraft(draft)
      navigate('/login', { state: { from: '/custom-piece' } })
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
        navigate('/login', { state: { from: '/custom-piece' } })
        return
      }
      const fields = readCustomRequestFieldErrors(error)
      if (Object.keys(fields).length > 0) setFieldErrors(fields)
      else setFormError(readCustomRequestApiError(error))
      // Nothing the shopper entered is cleared on failure.
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  const described = (key: string) => (fieldErrors[key] ? errId(key) : undefined)

  return (
    <div className="bg-[#faf7f2]">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:py-12">
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
              <div className="min-w-0 lg:col-start-1 lg:row-start-1">
                <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                  Custom Panchvastra
                </p>
                <h1 className="mt-2 font-display text-[2.1rem] font-bold uppercase leading-[1.02] tracking-tight text-black sm:text-5xl lg:text-[3.4rem]">
                  Build Your Piece.
                </h1>
                <p className="mt-3 text-sm text-zinc-600 sm:text-base">
                  A few simple steps to create something that&rsquo;s truly yours.
                </p>
                <span className="mt-5 block h-px w-14 bg-zinc-300" aria-hidden />

              </div>

              <aside className="min-w-0 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:pt-1">
                <h2 className="font-display text-lg font-bold uppercase leading-tight tracking-tight text-black">
                  Your idea.
                  <br />
                  Our craft.
                </h2>
                <span className="mt-3 block h-px w-10 bg-zinc-300" aria-hidden />

                <ul className="mt-5 space-y-4">
                  {PROMISES.map(({ Icon, label }) => (
                    <li key={label} className="flex items-center gap-3">
                      <Icon className="size-[22px] shrink-0 text-black" />
                      <span className="text-sm text-zinc-700">{label}</span>
                    </li>
                  ))}
                </ul>

                <span className="mt-6 block h-px w-full bg-[#e8e1d6]" aria-hidden />

                <h3 className="mt-6 font-display text-sm font-bold uppercase tracking-[0.08em] text-black">Need help?</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">
                  Have a design idea or any questions? We&rsquo;re here on WhatsApp.
                </p>
                <a
                  href={whatsAppPageUrl()}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-4 inline-flex min-h-[46px] w-full items-center justify-center gap-2.5 rounded-xl border border-[#ded6c9] bg-white px-4 text-sm font-semibold text-black transition-colors hover:border-black"
                >
                  <IconWhatsApp className="size-[18px]" />
                  Chat with us
                  <IconArrowRight className="size-4" />
                </a>
              </aside>

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
                          on ? 'border-black bg-white' : 'border-[#ece6dc] bg-[#fdfcfa] hover:border-zinc-300'
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
                        <OptionArt src={g.image_url} name={g.name} className="h-32 w-full rounded-lg object-contain" />
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
                                on ? 'border-black' : 'border-[#e0d8cb]'
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
                    <div className="flex items-start gap-3 sm:border-l sm:border-[#ece6dc] sm:pl-8">
                      <IconInfo className="size-5 shrink-0 text-zinc-400" />
                      <p className="text-sm leading-snug text-zinc-600">
                        {selectedGarment.name} is available only in {availableColours[0].name}.
                      </p>
                    </div>
                  ) : null}
                  {selectedGarment && availableColours.length === 0 ? (
                    <div className="flex items-start gap-3 sm:border-l sm:border-[#ece6dc] sm:pl-8">
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
                            on ? 'border-black bg-white text-black' : 'border-[#ece6dc] bg-[#fdfcfa] text-zinc-600 hover:border-zinc-300'
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
                          on ? 'border-black bg-white' : 'border-[#ece6dc] bg-[#fdfcfa] hover:border-zinc-300'
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
                        <OptionArt src={p.image_url} name={p.name} className="w-32 shrink-0 self-stretch object-cover" />
                        <span className="min-w-0 flex-1 py-4 pr-10">
                          <span className="block font-display text-sm font-bold uppercase tracking-[0.06em] text-black">
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
                            <span className="block size-5 rounded-full border border-[#ddd5c8]" aria-hidden />
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
                      dragging ? 'border-black bg-[#f6f3ee]' : 'border-[#ddd5c8] bg-[#fdfcfa] hover:border-zinc-400'
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
                    <span className="hidden h-full w-px flex-1 bg-[#ece6dc] lg:block" aria-hidden />
                    <span className="px-3 py-1 text-xs font-bold uppercase tracking-wide text-zinc-400">or</span>
                    <span className="hidden h-full w-px flex-1 bg-[#ece6dc] lg:block" aria-hidden />
                  </div>

                  <div className="rounded-xl bg-[#faf7f2] p-4">
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
                      className="mt-3 w-full resize-y rounded-lg border border-[#e4ddd2] bg-white px-3.5 py-2.5 text-sm text-black outline-none transition-colors placeholder:text-zinc-400 focus:border-black disabled:opacity-60"
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
                        onChange={(e) => set('fullName', e.target.value)}
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
                    <div className="relative flex items-stretch rounded-xl border border-[#e4ddd2] bg-white focus-within:border-black">
                      <IconPhone className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-zinc-400" />
                      <label htmlFor={fid('code')} className="sr-only">
                        Country code
                      </label>
                      {/* `basis-*`, not `w-*`: a width utility here can lose to another one
                          depending on stylesheet order, which would push the number field
                          off a narrow screen. flex-basis sets the main size regardless. */}
                      <input
                        id={fid('code')}
                        name="phone_country_code"
                        type="text"
                        value={draft.countryCode}
                        maxLength={PHONE_COUNTRY_CODE_MAX}
                        disabled={sending}
                        onChange={(e) => set('countryCode', e.target.value)}
                        className="shrink-0 grow-0 basis-[86px] border-none bg-transparent py-3 pl-10 pr-1 text-sm text-black outline-none disabled:opacity-60 sm:basis-24 sm:pl-11 sm:pr-2"
                      />
                      <span className="my-2.5 w-px shrink-0 bg-[#ece6dc]" aria-hidden />
                      <input
                        id={fid('phone')}
                        name="phone_number"
                        type="tel"
                        inputMode="numeric"
                        value={draft.phone}
                        maxLength={PHONE_NUMBER_MAX}
                        disabled={sending}
                        autoComplete="tel-national"
                        onChange={(e) => set('phone', e.target.value)}
                        aria-invalid={Boolean(fieldErrors.phone_number)}
                        aria-describedby={described('phone_number')}
                        placeholder="Phone Number (WhatsApp)"
                        className="min-w-0 flex-1 border-none bg-transparent px-3.5 py-3 text-sm text-black outline-none placeholder:text-zinc-400 disabled:opacity-60"
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
              <p className="mt-5 rounded-xl border border-[#ded6c9] bg-white px-4 py-3 text-sm text-zinc-700" role="status">
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
                className="inline-flex min-h-[52px] w-full max-w-xl items-center justify-center gap-3 rounded-xl bg-black px-8 text-xs font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
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

        {/* ============ how it works ============ */}
        <section className="mt-10 rounded-2xl border border-[#ece6dc] bg-white px-5 py-7 sm:px-8">
          <div className="grid grid-cols-1 gap-7 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-center lg:gap-10">
            <div>
              <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
                How it works
              </p>
              <h2 className="mt-2 font-display text-2xl font-bold uppercase leading-[1.05] tracking-tight text-black sm:text-3xl">
                From idea
                <br />
                to you.
              </h2>
              <p className="mt-2 text-sm text-zinc-500">A simple process, made for you.</p>
            </div>

            <ol className="grid grid-cols-1 gap-6 sm:grid-cols-3 lg:grid-cols-5 lg:gap-3">
              {HOW_IT_WORKS.map(({ Icon, step, title, copy }, index) => (
                <li key={step} className="relative flex flex-col items-center text-center">
                  <Icon className="size-7 text-black" />
                  <span className="mt-2.5 block text-[11px] font-bold tracking-[0.14em] text-zinc-400">{step}</span>
                  <span className="mt-1 block font-display text-xs font-bold uppercase tracking-[0.1em] text-black">
                    {title}
                  </span>
                  <span className="mt-1.5 block text-xs leading-snug text-zinc-500">{copy}</span>
                  {/* Connector between steps — decorative, and only where there is a next
                      step on the same row. */}
                  {index < HOW_IT_WORKS.length - 1 ? (
                    <span
                      className="absolute -right-2 top-3 hidden text-zinc-300 lg:block"
                      aria-hidden
                    >
                      →
                    </span>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </section>
      </div>

      {sizeChart ? <SizeChart isOpen={chartOpen} onClose={() => setChartOpen(false)} chart={sizeChart} /> : null}
    </div>
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
