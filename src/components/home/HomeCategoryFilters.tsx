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
  if (categories.length === 0) return null

  return (
    <div role="tablist" aria-label="Shop by category" className="flex flex-wrap items-center justify-center gap-2.5 px-4 py-10">
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
