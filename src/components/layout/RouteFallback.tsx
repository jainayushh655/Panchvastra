/**
 * What fills the page area while a route's chunk is downloading.
 *
 * Deliberately a still, neutral block rather than a spinner. On a fast connection a chunk
 * arrives in well under a second, and a spinner that appears and vanishes in 200ms reads
 * as a flicker — it draws the eye to a problem that is not there. A quiet placeholder of
 * roughly the right shape does not.
 *
 * `min-h` holds the viewport open so the footer does not jump up and then back down as
 * the real page mounts. That jump is the whole reason this component exists rather than
 * `fallback={null}`.
 */
export function RouteFallback() {
  return (
    <div className="mx-auto min-h-[60vh] w-full max-w-7xl px-4 py-10" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>

      <div className="h-3 w-24 rounded-sm bg-soft-beige" />
      <div className="mt-4 h-8 w-2/3 max-w-sm rounded-sm bg-soft-beige" />

      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index}>
            <div className="aspect-[4/5] w-full rounded-xl bg-soft-beige" />
            <div className="mt-3 h-3 w-3/4 rounded-sm bg-soft-beige" />
            <div className="mt-2 h-3 w-1/3 rounded-sm bg-soft-beige" />
          </div>
        ))}
      </div>
    </div>
  )
}
