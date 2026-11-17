import { categoryNameToSlug } from '@/lib/categorySlug'
import type { CategoryDto } from '@/types/api/CategoryDto'

export function HomeCategoryFilters({
  categories,
  active,
  onChange,
}: {
  categories: CategoryDto[]
  active: string
  onChange: (slug: string) => void
}) {
  /*
   * A filter needs something to filter BETWEEN, so the row appears only from two
   * categories up. `categories` is already the homepage's `availableCategories` — the ones
   * that actually have products — so an empty category never keeps the row alive on its
   * own, and the count means the same thing here as it does for the category tiles above.
   *
   * Hiding the row does not change what the grid shows: the selected category lives in
   * HomePage, which defaults it to the first available category whether or not these
   * buttons are rendered.
   */
  if (categories.length < 2) return null

  return (
    <div role="tablist" aria-label="Shop by category" className="flex flex-wrap items-center justify-center gap-2.5 px-4 pb-8 pt-1 sm:pb-9">
      {categories.map((c) => {
        const slug = categoryNameToSlug(c.name)
        const selected = active === slug
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(slug)}
            className={`rounded-full border px-5 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
              selected ? 'border-black bg-black text-white' : 'border-black bg-white text-black hover:bg-zinc-100'
            }`}
          >
            {c.name}
          </button>
        )
      })}
    </div>
  )
}
