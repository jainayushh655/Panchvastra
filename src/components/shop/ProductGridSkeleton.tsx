export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="col-span-full space-y-4">
      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">Loading products…</p>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="aspect-[5/4] animate-pulse rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/80"
            aria-hidden
          />
        ))}
      </div>
    </div>
  )
}
