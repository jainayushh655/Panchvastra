import { useId, useRef, useState, type FormEvent } from 'react'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { createSupportQuery, readSupportApiError, readSupportFieldErrors } from '@/api/supportQuery'
import { SUPPORT_CATEGORIES } from '@/types/api/SupportQueryDto'
import type { SupportCategory, SupportFieldErrors } from '@/types/api/SupportQueryDto'
import { instagramHandle, instagramPageUrl, supportEmail, supportEmailUrl, whatsAppPageUrl } from '@/lib/siteUrls'

/**
 * Help Desk — the customer-facing support form.
 *
 * Replaces the previous Contact page, which was an explicit UI mock: it had a fake submit
 * ("this is a UI mock; wire to your CRM / email API"), an invented email address and
 * placeholder social links. Every contact detail here now comes from the project's own
 * `siteUrls` helpers and the address the policy pages publish — nothing is invented.
 *
 * The form posts to `POST /v1/support_query/`, which is public, so it works signed in or
 * signed out: the shared API client attaches the shopper's bearer token when a session
 * exists and omits it otherwise. There is no second auth path.
 */

/** Matches the backend's own `EmailField` closely enough to catch typos before the round trip. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const NAME_MAX = 100
const EMAIL_MAX = 254
const MESSAGE_MAX = 2000

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth={1.6} />
      <path d="m3.5 7 8.5 6 8.5-6" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.5 11.6a8.4 8.4 0 0 1-12.4 7.4L3.5 20.5l1.6-4.5a8.4 8.4 0 1 1 15.4-4.4z"
      />
      <path
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 9.2c.3-.7.6-.7.9-.7h.5c.2 0 .4 0 .6.5l.7 1.6c.1.3 0 .5-.1.6l-.4.5c-.1.2-.2.3 0 .6a6 6 0 0 0 2.7 2.3c.3.1.4 0 .6-.1l.5-.6c.2-.2.4-.1.6 0l1.5.8c.3.2.4.3.4.5 0 .5-.3 1.3-1 1.6-.5.2-1.2.3-2.6-.2a9.3 9.3 0 0 1-4.6-4.1c-.6-1-.8-1.9-.8-2.5 0-.4.2-.7.5-.8z"
      />
    </svg>
  )
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" strokeWidth={1.6} />
      <circle cx="12" cy="12" r="4" strokeWidth={1.6} />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16m0 0-6-6m6 6-6 6" />
    </svg>
  )
}

function IconArrowUpRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17 17 7m0 0H8m9 0v9" />
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
  'w-full rounded-xl border border-zinc-300 bg-white px-3.5 py-3 text-sm text-black outline-none transition-colors placeholder:text-zinc-400 focus:border-black disabled:cursor-not-allowed disabled:opacity-60'
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

export function HelpDeskPage() {
  useDocumentTitle('Help Desk')

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

  const contactRows = [
    {
      key: 'email',
      Icon: IconMail,
      title: 'Email',
      detail: supportEmail(),
      href: supportEmailUrl(),
      external: false,
    },
    {
      key: 'whatsapp',
      Icon: IconWhatsApp,
      title: 'WhatsApp',
      detail: 'Chat with us about an order',
      href: whatsAppPageUrl(),
      external: true,
    },
    {
      key: 'instagram',
      Icon: IconInstagram,
      title: 'Instagram',
      detail: instagramHandle(),
      href: instagramPageUrl(),
      external: true,
    },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      {/*
        Two columns on desktop with a hairline between them; below `lg` the columns stack
        and the divider disappears, because a vertical rule between stacked blocks is just
        a stray line. `divide-x` handles both without a separate border element.
      */}
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-0 lg:divide-x lg:divide-zinc-200">
        {/* ------------------------------------------------------------ form */}
        <div className="min-w-0 lg:pr-12">
          <h1 className="type-page-title">Help Desk</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Questions, orders, or anything else? We&rsquo;re here to help.
          </p>

          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
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
                className={`mt-2 ${FIELD} ${fieldErrors.name ? FIELD_INVALID : ''}`}
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
                className={`mt-2 ${FIELD} ${fieldErrors.email ? FIELD_INVALID : ''}`}
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
              <div className="relative mt-2">
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
                  {/* The VALUE is sent, never the label. */}
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
                rows={6}
                value={draft.message}
                onChange={(e) => set('message', e.target.value)}
                maxLength={MESSAGE_MAX}
                disabled={sending}
                aria-invalid={Boolean(fieldErrors.message)}
                aria-describedby={describedBy('message')}
                placeholder="Message"
                className={`mt-2 resize-y ${FIELD} ${fieldErrors.message ? FIELD_INVALID : ''}`}
              />
              {/*
                The counter sits under the field now that the label row above it is hidden.
                Announced politely so it is not read out on every keystroke, and paired on
                one line with any validation message so the two never fight for space.
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
              // Sized to its content rather than the full column width, matching the
              // reference; still a 48px target, and it stretches on very narrow phones so
              // it never ends up a cramped stub.
              className="inline-flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-xl bg-black px-8 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {sending ? <IconSpinner className="size-4 animate-spin" /> : null}
              {sending ? 'Sending…' : 'Send Message'}
              {sending ? null : <IconArrowRight className="size-4" />}
            </button>

            {/* The API's own confirmation, shown verbatim — the UI never claims an email
                was sent, because only the backend knows what it did. */}
            {success ? (
              <p
                className="rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
                role="status"
              >
                {success}
              </p>
            ) : null}

            {formError ? (
              <p
                className="rounded-xl border border-red-500 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                role="alert"
              >
                {formError}
              </p>
            ) : null}
          </form>
        </div>

        {/* ------------------------------------------------------- contact rows */}
        <aside className="min-w-0 lg:pl-12">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Other ways to reach us</h2>

          <ul className="mt-5 space-y-2">
            {contactRows.map((row) => (
              <li key={row.key}>
                <a
                  href={row.href}
                  {...(row.external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                  className="group flex items-center gap-4 rounded-xl border border-transparent px-3 py-3 transition-colors hover:border-zinc-200 hover:bg-zinc-50"
                >
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-black transition-colors group-hover:border-black">
                    <row.Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-black">{row.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-zinc-500">{row.detail}</span>
                  </span>
                  {row.external ? (
                    <IconArrowUpRight className="size-4 shrink-0 text-zinc-400 transition-colors group-hover:text-black" />
                  ) : null}
                </a>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
