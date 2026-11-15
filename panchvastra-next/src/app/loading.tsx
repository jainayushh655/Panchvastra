/**
 * Route-level loading boundary — the fallback shown while a Server Component's data is
 * still being fetched. A Server Component itself; it has no state and no interaction.
 *
 * WHY IT IS A SKELETON AND NOT A SPINNER. The Vite app has no route-level loading state
 * at all: `<Suspense fallback={null}>` wraps only the admin chunk, deliberately blank so
 * nothing flashes on admin navigation, and each page manages its own in-page skeletons
 * (`ProductGridSkeleton` on Shop, for example). Carrying that philosophy forward, this
 * renders a neutral, non-animated placeholder in the brand's own surfaces rather than
 * introducing a spinner the design has never used.
 *
 * `animate-pulse` is intentionally absent: a full-page pulsing block is more distracting
 * than a still one, and the fallback is usually visible for a few hundred milliseconds.
 *
 * Phase 4 adds per-route `loading.tsx` files that mirror each page's real layout, which
 * is what actually removes perceived latency. This generic one is the floor, not the goal.
 */
export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12" role="status" aria-busy="true">
      <span className="sr-only">Loading</span>

      <div className="h-3 w-28 rounded-sm bg-zinc-200" />
      <div className="mt-4 h-8 w-2/3 max-w-sm rounded-sm bg-zinc-200" />

      <div className="mt-10 space-y-3">
        <div className="h-3 w-full max-w-xl rounded-sm bg-zinc-200" />
        <div className="h-3 w-5/6 max-w-lg rounded-sm bg-zinc-200" />
        <div className="h-3 w-3/4 max-w-md rounded-sm bg-zinc-200" />
      </div>
    </div>
  )
}
