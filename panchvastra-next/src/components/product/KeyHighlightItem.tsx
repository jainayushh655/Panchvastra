import type { ResolvedProductHighlight } from '@/lib/productHighlights'

export function KeyHighlightItem({ specLabel, value }: ResolvedProductHighlight) {
  return (
    <div className="min-w-0 border-b border-zinc-200 py-4 dark:border-zinc-800">
      <p className="font-sans text-xs font-medium text-zinc-500 dark:text-zinc-400">{specLabel}</p>
      <p className="mt-1 font-sans text-sm font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
    </div>
  )
}
