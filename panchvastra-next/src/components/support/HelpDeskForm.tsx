'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { createSupportQuery, readSupportApiError, readSupportFieldErrors } from '@/services/support'
import { SUPPORT_CATEGORIES } from '@/types/api/SupportQueryDto'
import type { SupportCategory, SupportFieldErrors } from '@/types/api/SupportQueryDto'

/**
 * The Help Desk form — the ONLY client island on `/help-desk`.
 *
 * Everything else on that page (the heading, the contact rows, the layout) is server
 * markup, so this component carries the whole of the route's interactivity and nothing
 * else. Ported from the Vite `HelpDeskPage`, behaviour for behaviour:
 *
 *   - the same four fields, the same client-side rules mirroring the backend's own limits
 *   - per-field errors shown beside their inputs, cleared per field as that field is typed
 *   - a synchronous in-flight guard against double submission
 *   - the form cleared ONLY after a confirmed 2xx; on failure every typed value survives
 *   - the API's own success message shown verbatim, then auto-dismissed after 3s
 *   - `sr-only` labels bound by `htmlFor`, `aria-invalid`, `aria-describedby`, `role="alert"`
 *
 * It works signed out: `POST /v1/support_query/` is public, and the shared client simply
 * omits the Authorization header when there is no session. No auth check is made here and
 * none should be — requiring a login to report a problem would be a regression.
 */

/** Matches the backend's own `EmailField` closely enough to catch typos before the round trip. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/*
 * The three caps the published schema declares for `CreateSupportQueryRequest`. They are
 * mirrored here so a too-long value fails instantly instead of after a round trip, and
 * they are also the inputs' `maxLength`, so the limit is enforced while typing.
 */
const NAME_MAX = 100
const EMAIL_MAX = 254
const MESSAGE_MAX = 2000

/** How long the confirmation stays on screen before the form returns to its resting state. */
const SUCCESS_VISIBLE_MS = 3000

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16m0 0-6-6m6 6-6 6" />
    </svg>
  )
}

function IconSpinner({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

const FIELD =
  'w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-2.5 text-sm text-black outline-none transition-colors placeholder:text-zinc-400 focus:border-black disabled:cursor-not-allowed disabled:opacity-60'
const FIELD_INVALID = 'border-red-500 focus:border-red-600'
/*
 * Labels are visually hidden, not removed. The field itself shows its name in the
 * placeholder, but a placeholder is not an accessible name — it disappears the moment
 * someone types, and several screen readers skip it entirely. Keeping a real <label>
 * bound by `htmlFor` means the field is still announced, and clicking the text still
 * focuses the input.
 */
const LABEL = 'sr-only'

type Draft = { name: string; email: string; category: string; message: string }

const EMPTY: Draft = { name: '', email: '', category: '', message: '' }

export function HelpDeskForm() {
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [fieldErrors, setFieldErrors] = useState<SupportFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  /** Synchronous guard — state is not applied immediately, so a double click could double-post. */
  const inFlight = useRef(false)

  const ids = useId()
  const fid = (name: string) => `${ids}-${name}`
  const errId = (name: string) => `${ids}-${name}-error`

  /*
   * The confirmation is transient: it shows for three seconds and then clears itself,
   * leaving the already-emptied form at rest and ready for another message. The fields
   * were cleared the moment the POST succeeded, so there is no stale state left over.
   *
   * The timer is torn down when the banner changes or the page unmounts, so it can never
   * fire against a later submission or set state on an unmounted component.
   */
  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(null), SUCCESS_VISIBLE_MS)
    return () => window.clearTimeout(timer)
  }, [success])

  /** Updating a field clears only that field's error, leaving the others in place. */
  const set = (key: keyof Draft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      if (!current[key as keyof SupportFieldErrors]) return current
      const next = { ...current }
      delete next[key as keyof SupportFieldErrors]
      return next
    })
  }

  /** Client-side checks, mirroring the backend's own rules so typos cost no round trip. */
  const validate = (values: Draft): SupportFieldErrors => {
    const errors: SupportFieldErrors = {}
    if (!values.name.trim()) errors.name = 'Please enter your name.'
    else if (values.name.trim().length > NAME_MAX) errors.name = `Keep this under ${NAME_MAX} characters.`

    if (!values.email.trim()) errors.email = 'Please enter your email.'
    else if (!EMAIL_PATTERN.test(values.email.trim())) errors.email = 'Enter a valid email address.'
    else if (values.email.trim().length > EMAIL_MAX) errors.email = `Keep this under ${EMAIL_MAX} characters.`

    if (!values.category) errors.category = 'Please choose a category.'

    if (!values.message.trim()) errors.message = 'Please write a message.'
    else if (values.message.trim().length > MESSAGE_MAX) errors.message = `Keep this under ${MESSAGE_MAX} characters.`

    return errors
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (inFlight.current || sending) return

    const trimmed: Draft = {
      name: draft.name.trim(),
      email: draft.email.trim(),
      category: draft.category,
      message: draft.message.trim(),
    }

    const invalid = validate(trimmed)
    if (Object.keys(invalid).length > 0) {
      setFieldErrors(invalid)
      setFormError(null)
      setSuccess(null)
      return
    }

    inFlight.current = true
    setSending(true)
    setFieldErrors({})
    setFormError(null)
    setSuccess(null)

    try {
      const message = await createSupportQuery({
        name: trimmed.name,
        email: trimmed.email,
        category: trimmed.category as SupportCategory,
        message: trimmed.message,
      })
      // Only a confirmed 2xx clears the form; the API's own wording is shown as-is.
      setDraft(EMPTY)
      setSuccess(message)
    } catch (error) {
      // A 400 carries per-field messages, which belong beside their inputs rather than
      // collapsed into one banner. Anything else is a single line.
      const fields = readSupportFieldErrors(error)
      if (Object.keys(fields).length > 0) setFieldErrors(fields)
      else setFormError(readSupportApiError(error))
      // `draft` is untouched on failure, so everything typed survives.
    } finally {
      inFlight.current = false
      setSending(false)
    }
  }

  const describedBy = (field: keyof SupportFieldErrors) => (fieldErrors[field] ? errId(field) : undefined)

  return (
    /* `space-y` only, with no top margin on the inputs themselves: the labels are
       `sr-only` and take no layout space, so a margin above each one was adding a gap
       that nothing visible sat in. */
    <form onSubmit={onSubmit} noValidate className="mt-5 space-y-3">
      <div>
        <label htmlFor={fid('name')} className={LABEL}>
          Name
        </label>
        <input
          id={fid('name')}
          name="name"
          type="text"
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          maxLength={NAME_MAX}
          disabled={sending}
          autoComplete="name"
          aria-invalid={Boolean(fieldErrors.name)}
          aria-describedby={describedBy('name')}
          placeholder="Name"
          className={`${FIELD} ${fieldErrors.name ? FIELD_INVALID : ''}`}
        />
        {fieldErrors.name ? (
          <p id={errId('name')} className="mt-1.5 text-xs font-semibold text-red-600" role="alert">
            {fieldErrors.name}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={fid('email')} className={LABEL}>
          Email
        </label>
        <input
          id={fid('email')}
          name="email"
          type="email"
          value={draft.email}
          onChange={(e) => set('email', e.target.value)}
          maxLength={EMAIL_MAX}
          disabled={sending}
          autoComplete="email"
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={describedBy('email')}
          placeholder="Email"
          className={`${FIELD} ${fieldErrors.email ? FIELD_INVALID : ''}`}
        />
        {fieldErrors.email ? (
          <p id={errId('email')} className="mt-1.5 text-xs font-semibold text-red-600" role="alert">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={fid('category')} className={LABEL}>
          Category
        </label>
        <div className="relative">
          <select
            id={fid('category')}
            name="category"
            value={draft.category}
            onChange={(e) => set('category', e.target.value)}
            disabled={sending}
            aria-invalid={Boolean(fieldErrors.category)}
            aria-describedby={describedBy('category')}
            className={`${FIELD} cursor-pointer appearance-none pr-10 [color-scheme:light] ${
              fieldErrors.category ? FIELD_INVALID : ''
            } ${draft.category ? '' : 'text-zinc-400'}`}
          >
            <option value="">Select a Category</option>
            {/* The VALUE is sent, never the label — an unknown value is rejected by the
                backend with `"BOGUS" is not a valid choice.` */}
            {SUPPORT_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value} className="text-black">
                {option.label}
              </option>
            ))}
          </select>
          <svg
            className="pointer-events-none absolute right-3.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {fieldErrors.category ? (
          <p id={errId('category')} className="mt-1.5 text-xs font-semibold text-red-600" role="alert">
            {fieldErrors.category}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={fid('message')} className={LABEL}>
          Message
        </label>
        <textarea
          id={fid('message')}
          name="message"
          rows={4}
          value={draft.message}
          onChange={(e) => set('message', e.target.value)}
          maxLength={MESSAGE_MAX}
          disabled={sending}
          aria-invalid={Boolean(fieldErrors.message)}
          aria-describedby={describedBy('message')}
          placeholder="Message"
          className={`resize-y ${FIELD} ${fieldErrors.message ? FIELD_INVALID : ''}`}
        />
        {/*
          The counter sits under the field now that the label row above it is hidden.
          Announced politely so it is not read out on every keystroke, and paired on one
          line with any validation message so the two never fight for space.
        */}
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <span className="min-w-0 flex-1">
            {fieldErrors.message ? (
              <span id={errId('message')} className="text-xs font-semibold text-red-600" role="alert">
                {fieldErrors.message}
              </span>
            ) : null}
          </span>
          <span className="shrink-0 text-[11px] tabular-nums text-zinc-500" aria-live="polite">
            {draft.message.length}/{MESSAGE_MAX}
          </span>
        </div>
      </div>

      <button
        type="submit"
        disabled={sending}
        aria-busy={sending}
        // Sized to its content rather than the full column width; still a 48px target, and
        // it stretches on very narrow phones so it never ends up a cramped stub.
        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-chocolate px-8 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {sending ? <IconSpinner className="size-4 animate-spin" /> : null}
        {sending ? 'Sending…' : 'Send Message'}
        {sending ? null : <IconArrowRight className="size-4" />}
      </button>

      {/* The API's own confirmation, shown verbatim — the UI never claims an email was
          sent, because only the backend knows what it did. */}
      {success ? (
        <p
          className="rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800"
          role="status"
        >
          {success}
        </p>
      ) : null}

      {formError ? (
        <p
          className="rounded-xl border border-red-500 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700"
          role="alert"
        >
          {formError}
        </p>
      ) : null}
    </form>
  )
}
