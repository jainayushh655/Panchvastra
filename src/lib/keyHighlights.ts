/**
 * Key highlights — one shared reader for the backend's `{ label, value }[]` contract.
 *
 * The backend now returns and accepts a real array, so there is NO encoding layer here:
 * the array goes into `data` as-is and `JSON.stringify` of the whole payload is the only
 * serialisation. The previous JSON-string unwrapping is gone.
 *
 * `readKeyHighlights` exists only to be defensive on READ: a legacy product that was saved
 * under the old string format must not crash the editor or the product page. It normalises
 * such a value into the new shape where that is unambiguous, and otherwise yields nothing.
 * It never rewrites stored data — whatever the admin then saves is the new format.
 */

export type KeyHighlight = {
  label: string
  value: string
}

/** True for a `{ label, value }` pair with usable strings. */
function asPair(entry: unknown): KeyHighlight | null {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null
  const record = entry as Record<string, unknown>
  const label = typeof record.label === 'string' ? record.label.trim() : ''
  const value = typeof record.value === 'string' ? record.value.trim() : ''
  if (!label || !value) return null
  return { label, value }
}

/**
 * Reads whatever the API returned into the new array shape.
 *
 * Accepts: the contract's `{label, value}[]`; a JSON string holding one (legacy rows the
 * backend has not normalised yet); and a legacy array of plain strings, which becomes
 * value-only rows so the admin can see and re-enter them. Anything else yields `[]`.
 * Parsing is attempted at most ONCE — no recursive peeling.
 */
export function readKeyHighlights(raw: unknown): KeyHighlight[] {
  let source = raw

  if (typeof source === 'string') {
    const text = source.trim()
    if (!text) return []
    try {
      source = JSON.parse(text) as unknown
    } catch {
      // Plain prose from an old free-text field — not a label/value pair, so nothing
      // structured can be claimed for it.
      return []
    }
  }

  if (!Array.isArray(source)) return []

  const rows: KeyHighlight[] = []
  for (const entry of source) {
    const pair = asPair(entry)
    if (pair) {
      rows.push(pair)
      continue
    }
    // Legacy `["Yarn-dyed stripes", …]`: keep the text visible rather than dropping it.
    if (typeof entry === 'string' && entry.trim()) {
      rows.push({ label: '', value: entry.trim() })
    }
  }

  return rows
}

/**
 * Validates the admin's rows, returning the first problem or `null`.
 *
 * Duplicates are reported, never silently merged or dropped, so the admin decides what to
 * keep. Comparison is case-insensitive on the trimmed label.
 */
export function validateKeyHighlights(rows: KeyHighlight[]): string | null {
  const seen = new Map<string, number>()

  for (let index = 0; index < rows.length; index += 1) {
    const label = rows[index].label.trim()
    const value = rows[index].value.trim()

    if (!label) return `Key highlight ${index + 1} needs a label.`
    if (!value) return `Key highlight ${index + 1} ("${label}") needs a value.`

    const key = label.toLowerCase()
    const first = seen.get(key)
    if (first !== undefined) {
      return `Key highlights ${first + 1} and ${index + 1} use the same label ("${label}"). Labels must be unique.`
    }
    seen.set(key, index)
  }

  return null
}

/** Trims every row for submission. Order is preserved exactly as the admin arranged it. */
export function toKeyHighlightsPayload(rows: KeyHighlight[]): KeyHighlight[] {
  return rows.map((row) => ({ label: row.label.trim(), value: row.value.trim() }))
}
