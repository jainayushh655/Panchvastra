export function formatInr(amount: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

/* ------------------------------------------------------------------ order dates */

/**
 * Orders are rendered in the store's own timezone rather than the viewer's.
 *
 * Panchvastra is an India-only storefront, and an order's time has to mean the same thing
 * to the customer who placed it and to an admin reading the audit trail — if this used the
 * browser's local zone, the same `ordered_at` would read differently for each of them and
 * the status history would stop being a reliable record. The API contract specifies the
 * display FORMAT ("12 Oct 2026, 10:24 AM") but says nothing about timezone, so this is the
 * one display decision made here; it is a single constant, so changing it is a one-liner.
 */
const ORDER_TIME_ZONE = 'Asia/Kolkata'

/** `YYYY-MM-DD` — a calendar date with no time component (`expected_delivery_date`). */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function parseTimestamp(value: string): Date | null {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Assembles the output from `formatToParts` rather than trusting a locale's own pattern.
 *
 * Locales differ on separators and on whether the day period is "AM", "am" or "a.m.", and
 * those differences move with the ICU build. Reading the parts and joining them keeps the
 * contract's exact format stable wherever this runs.
 */
function dateParts(date: Date, options: Intl.DateTimeFormatOptions): Record<string, string> {
  const formatter = new Intl.DateTimeFormat('en-GB', { ...options })
  const result: Record<string, string> = {}
  for (const part of formatter.formatToParts(date)) result[part.type] = part.value
  return result
}

/** "12 Oct 2026, 10:24 AM" — for every ISO 8601 timestamp the order API returns. */
export function formatOrderDateTime(value: string | null | undefined): string | null {
  if (!value) return null
  const date = parseTimestamp(value)
  if (!date) return null

  const p = dateParts(date, {
    timeZone: ORDER_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return `${p.day} ${p.month} ${p.year}, ${p.hour}:${p.minute} ${(p.dayPeriod ?? '').toUpperCase()}`.trim()
}

/** "12 Oct, 10:24 AM" — the compact stamp under a completed timeline node. */
export function formatOrderTimelineStamp(value: string | null | undefined): string | null {
  if (!value) return null
  const date = parseTimestamp(value)
  if (!date) return null

  const p = dateParts(date, {
    timeZone: ORDER_TIME_ZONE,
    day: '2-digit',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  return `${p.day} ${p.month}, ${p.hour}:${p.minute} ${(p.dayPeriod ?? '').toUpperCase()}`.trim()
}

/**
 * "14 Oct 2026" — a date with no time, ever.
 *
 * `expected_delivery_date` arrives as a bare `YYYY-MM-DD`. Passing that to `new Date()`
 * parses it as UTC midnight, which in any negative-offset zone renders as the PREVIOUS
 * day; it is therefore split and rebuilt as a UTC instant and formatted in UTC, so the
 * calendar date shown is always the one the backend sent. A full timestamp passed here
 * is formatted in the store timezone like any other.
 */
export function formatOrderDate(value: string | null | undefined): string | null {
  if (!value) return null

  if (DATE_ONLY_PATTERN.test(value)) {
    const [year, month, day] = value.split('-').map(Number)
    const utc = new Date(Date.UTC(year, month - 1, day))
    if (Number.isNaN(utc.getTime())) return null
    const p = dateParts(utc, { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })
    return `${p.day} ${p.month} ${p.year}`
  }

  const date = parseTimestamp(value)
  if (!date) return null
  const p = dateParts(date, { timeZone: ORDER_TIME_ZONE, day: '2-digit', month: 'short', year: 'numeric' })
  return `${p.day} ${p.month} ${p.year}`
}
