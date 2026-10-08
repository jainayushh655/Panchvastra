import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
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
 * Every choice on this page is rendered from `GET /v1/custom_options/` in the order the API
 * returns it. No option name, id or count is hardcoded: adding a garment in the admin panel
 * puts it on this page with no deploy.
 *
 * The page itself is PUBLIC so the builder can be explored signed out; only the submission
 * needs a session, which is what the contract specifies.
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
 * storage. The page says so in as many words when it restores a draft, so the one thing
 * that could not be kept is never silently missing.
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

const FIELD =
  'w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition-colors placeholder:text-zinc-400 focus:border-black disabled:cursor-not-allowed disabled:opacity-60'
const FIELD_INVALID = 'border-red-500 focus:border-red-600'
const LABEL = 'block text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-500'

/** Neutral stand-in for an option whose `image_url` is null. */
function OptionThumb({ src, name }: { src: string | null; name: string }) {
  if (!src) {
    return (
      <span
        className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-[11px] font-bold text-zinc-400"
        aria-hidden
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
    )
  }
  return <img src={src} alt="" className="size-10 shrink-0 rounded-lg object-cover" loading="lazy" />
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="mt-1.5 text-xs font-semibold text-red-600" role="alert">
      {message}
    </p>
  )
}

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
   * leaving the already-emptied form at rest and ready for another request. The timer is
   * torn down when the banner changes or the page unmounts, so it can never fire against a
   * later submission or set state on an unmounted component.
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

  // Derived from `options` rather than the `garments` const above, so the memo's identity
  // tracks the fetched data instead of a fresh array literal on every render.
  const selectedGarment = useMemo(
    () => (options?.garments ?? []).find((g) => g.id === draft.garmentId) ?? null,
    [options, draft.garmentId],
  )

  /**
   * Only the colours this garment can actually be ordered in — `colour_ids` is how the
   * backend expresses "Hoodie comes in Black only". The colours list keeps the API's own
   * order rather than the garment's id order.
   */
  const availableColours = useMemo<ColourDto[]>(() => {
    const all = options?.colours ?? []
    if (!selectedGarment) return all
    const allowed = new Set(selectedGarment.colour_ids)
    return all.filter((c) => allowed.has(c.id))
  }, [options, selectedGarment])

  /*
   * Changing the garment can strip the colour that was chosen. Rather than submitting a
   * pair the backend would reject, the selection is corrected here: kept when the new
   * garment still offers it, moved to the only option when there is just one, and otherwise
   * cleared so the shopper picks again.
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
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="type-page-title">Custom Piece</h1>
      <p className="mt-1 text-sm text-zinc-600">Your idea, made uniquely yours.</p>

      {loadError ? (
        <p className="mt-6 rounded-xl border border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
          {loadError}
        </p>
      ) : null}

      {!options && !loadError ? <p className="mt-6 text-sm text-zinc-500">Loading options…</p> : null}

      {options ? (
        <form onSubmit={onSubmit} noValidate className="mt-6 space-y-7">
          {/* Non-field problems sit at the top of the form, where they are read first. */}
          {formError ? (
            <p className="rounded-xl border border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700" role="alert">
              {formError}
            </p>
          ) : null}

          {restored ? (
            <p className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-3 text-sm text-zinc-700" role="status">
              We kept your selections. Please choose your design file again — files are not carried across sign-in.
            </p>
          ) : null}

          {/* ---------------------------------------------------------------- garment */}
          <fieldset>
            <legend className={LABEL}>Garment</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {garments.map((g) => (
                <label
                  key={g.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                    draft.garmentId === g.id ? 'border-black bg-zinc-50' : 'border-zinc-300 hover:border-zinc-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="garment"
                    value={g.id}
                    checked={draft.garmentId === g.id}
                    onChange={() => set('garmentId', g.id)}
                    className="size-4 accent-black"
                  />
                  <OptionThumb src={g.image_url} name={g.name} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-black">{g.name}</span>
                    {g.description ? (
                      <span className="mt-0.5 block text-xs text-zinc-500">{g.description}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
            <FieldError id={errId('garment_id')} message={fieldErrors.garment_id} />
          </fieldset>

          {/* ---------------------------------------------------------------- colour */}
          <fieldset>
            <legend className={LABEL}>Colour</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {availableColours.map((c) => (
                <label
                  key={c.id}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors ${
                    draft.colourId === c.id ? 'border-black bg-zinc-50' : 'border-zinc-300 hover:border-zinc-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="colour"
                    value={c.id}
                    checked={draft.colourId === c.id}
                    onChange={() => set('colourId', c.id)}
                    className="sr-only"
                  />
                  <span
                    className="size-5 shrink-0 rounded-full border border-zinc-300"
                    style={c.hex_code ? { backgroundColor: c.hex_code } : undefined}
                    aria-hidden
                  />
                  <span className="text-sm font-semibold text-black">{c.name}</span>
                </label>
              ))}
            </div>
            {/* The note the contract calls for: this garment has exactly one colour. */}
            {selectedGarment && availableColours.length === 1 ? (
              <p className="mt-2 text-xs text-zinc-500">
                {selectedGarment.name} is available in {availableColours[0].name} only.
              </p>
            ) : null}
            {selectedGarment && availableColours.length === 0 ? (
              <p className="mt-2 text-xs font-semibold text-red-600" role="alert">
                {selectedGarment.name} has no colours available right now. Please choose another garment.
              </p>
            ) : null}
            <FieldError id={errId('colour_id')} message={fieldErrors.colour_id} />
          </fieldset>

          {/* ---------------------------------------------------------------- size */}
          <fieldset>
            <legend className={LABEL}>Size</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {sizes.map((s) => (
                <label
                  key={s.id}
                  className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                    draft.sizeId === s.id
                      ? 'border-black bg-black text-white'
                      : 'border-zinc-300 text-black hover:border-zinc-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="size"
                    value={s.id}
                    checked={draft.sizeId === s.id}
                    onChange={() => set('sizeId', s.id)}
                    className="sr-only"
                  />
                  {s.name}
                </label>
              ))}
            </div>
            <FieldError id={errId('size_id')} message={fieldErrors.size_id} />
          </fieldset>

          {/* ---------------------------------------------------------------- print type */}
          <fieldset>
            <legend className={LABEL}>Print type</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {printTypes.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                    draft.printTypeId === p.id ? 'border-black bg-zinc-50' : 'border-zinc-300 hover:border-zinc-400'
                  }`}
                >
                  <input
                    type="radio"
                    name="print_type"
                    value={p.id}
                    checked={draft.printTypeId === p.id}
                    onChange={() => set('printTypeId', p.id)}
                    className="size-4 accent-black"
                  />
                  <OptionThumb src={p.image_url} name={p.name} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-black">{p.name}</span>
                    {p.description ? (
                      <span className="mt-0.5 block text-xs text-zinc-500">{p.description}</span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
            <FieldError id={errId('print_type_id')} message={fieldErrors.print_type_id} />
          </fieldset>

          {/* ---------------------------------------------------------------- design */}
          <div>
            <label htmlFor={fid('file')} className={LABEL}>
              Design file
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
              className="mt-2 block w-full text-sm text-zinc-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border file:border-zinc-300 file:bg-white file:px-3 file:py-2 file:text-xs file:font-bold file:uppercase file:tracking-wide hover:file:bg-zinc-50"
            />
            <p className="mt-1.5 text-xs text-zinc-500">PNG, JPG or PDF, up to 10 MB.</p>
            <FieldError id={errId('design_file')} message={fileError ?? fieldErrors.design_file} />
          </div>

          <div>
            <label htmlFor={fid('description')} className={LABEL}>
              Describe your design
            </label>
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
              placeholder="Tell us what you have in mind."
              className={`mt-2 resize-y ${FIELD} ${fieldErrors.design_description ? FIELD_INVALID : ''}`}
            />
            <div className="mt-1.5 flex items-start justify-between gap-3">
              <span className="min-w-0 flex-1">
                <FieldError id={errId('design_description')} message={fieldErrors.design_description} />
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-zinc-500" aria-live="polite">
                {draft.description.length}/{DESIGN_DESCRIPTION_MAX}
              </span>
            </div>
          </div>

          {/* ---------------------------------------------------------------- contact */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={fid('name')} className={LABEL}>
                Full name
              </label>
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
                className={`mt-2 ${FIELD} ${fieldErrors.full_name ? FIELD_INVALID : ''}`}
              />
              <FieldError id={errId('full_name')} message={fieldErrors.full_name} />
            </div>

            <div>
              <label htmlFor={fid('phone')} className={LABEL}>
                Phone number
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  id={fid('code')}
                  name="phone_country_code"
                  type="text"
                  value={draft.countryCode}
                  maxLength={PHONE_COUNTRY_CODE_MAX}
                  disabled={sending}
                  onChange={(e) => set('countryCode', e.target.value)}
                  aria-label="Country code"
                  aria-invalid={Boolean(fieldErrors.phone_country_code)}
                  /* Sized with `basis-*`, not `w-*`: the shared FIELD string already carries
                     `w-full`, and which of two width utilities wins depends on their order in
                     the generated stylesheet, not on the order written here. `flex-basis`
                     sets the main size in a flex row regardless, so this cannot be
                     overridden into a full-width box that pushes the phone field off-screen. */
                  className={`shrink-0 grow-0 basis-20 ${FIELD} ${fieldErrors.phone_country_code ? FIELD_INVALID : ''}`}
                />
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
                  className={`min-w-0 flex-1 ${FIELD} ${fieldErrors.phone_number ? FIELD_INVALID : ''}`}
                />
              </div>
              <FieldError id={errId('phone_number')} message={fieldErrors.phone_number ?? fieldErrors.phone_country_code} />
            </div>
          </div>

          <button
            type="submit"
            disabled={sending}
            aria-busy={sending}
            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-black px-8 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {sending ? 'Sending…' : 'Create my piece'}
          </button>

          {/* The API's own confirmation, shown verbatim as plain text. */}
          {success ? (
            <p
              className="rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-3 text-sm font-semibold whitespace-pre-wrap text-emerald-800"
              role="status"
            >
              {success}
            </p>
          ) : null}
        </form>
      ) : null}
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
