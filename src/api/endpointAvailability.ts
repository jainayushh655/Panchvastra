/**
 * Telling "this route does not exist" apart from "this record does not exist".
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE PROBLEM
 * ──────────────────────────────────────────────────────────────────────────────
 * Both arrive as HTTP 404, and the frontend's reaction to them should be opposite:
 *
 *   - A RESOURCE 404 ("review 7 is gone") is a real answer to a real question. The
 *     shopper should be told.
 *   - A ROUTING 404 ("/v1/product_reviews/ is not deployed") is a gap between this build
 *     and the backend. The shopper did nothing, can do nothing, and showing them "That
 *     review could not be found" is simply wrong — it describes a record that was never
 *     the problem.
 *
 * Conflating them is how a missing endpoint came to read as a missing review, and how a
 * missing wishlist endpoint came to read as "Unable to load your wishlist right now."
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * HOW THEY ARE DISTINGUISHED
 * ──────────────────────────────────────────────────────────────────────────────
 * By the body, which is unambiguous on this backend:
 *
 *   - Every real API response — success or failure — is the JSON envelope
 *     `{ success, message, data }`. Axios parses it, so `response.data` is an OBJECT.
 *   - A route Django has no pattern for never reaches a view. Django answers with its own
 *     HTML 404 page (`Content-Type: text/html`, several kilobytes), which axios cannot
 *     parse, so `response.data` is a STRING.
 *
 * So: a 404 whose body is not a JSON object did not come from the API at all. That is the
 * test. It needs no endpoint list to maintain and no version flag to keep in step.
 */

/**
 * True when a 404 came from routing rather than from a view — i.e. the endpoint is not
 * deployed on this backend.
 *
 * Anything that is not a 404 is false, so this is always safe to check first.
 */
export function isEndpointMissing(error: unknown): boolean {
  const response = (error as { response?: { status?: number; data?: unknown } }).response
  if (response?.status !== 404) return false

  const data = response.data

  // Django's HTML 404 page, or any other unparsed body.
  if (typeof data === 'string') return true

  // The API envelope — a genuine "not found" answered by a view.
  if (data && typeof data === 'object') return false

  // No body at all. Treated as missing: a view on this backend always answers with the
  // envelope, so an empty 404 did not come from one.
  return true
}

/**
 * Warns once per endpoint, in the console, that a route is missing.
 *
 * Deliberately not a toast. The shopper is not the audience — the symptom they see is a
 * feature degrading quietly, which is correct — and whoever is wondering why a shipped
 * feature looks empty needs the endpoint name, which this gives them.
 *
 * De-duplicated because these reads fire on every page that shows the feature, and the
 * same warning fifty times buries everything else in the console.
 */
const warned = new Set<string>()

export function warnEndpointMissing(endpoint: string, consequence: string): void {
  if (warned.has(endpoint)) return
  warned.add(endpoint)

  console.warn(
    `[panchvastra] ${endpoint} returned a routing 404 — this endpoint is not deployed on the backend this build is pointed at. ${consequence}`,
  )
}
