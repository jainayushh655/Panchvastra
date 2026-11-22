'use client'

import { FilterSelect } from '@/components/shop/FilterSelect'
import { categoryNameToSlug } from '@/lib/categorySlug'
import { PRICE_BUCKETS, SIZE_OPTIONS, type SubCategoryOption } from '@/lib/shopQuery'
import type { CategoryDto } from '@/types/api/CategoryDto'

/**
 * The Shop toolbar's four selects plus Reset.
 *
 * Ported from the Vite component. The only change is where the option data comes from:
 * `SIZE_OPTIONS` and `PRICE_BUCKETS` now live in `@/lib/shopQuery` so the server that
 * resolves the URL and the control that writes it read the same lists. Markup and classes
 * are unchanged.
 */
export function ShopFilterBar({
  categories,
  category,
  onCategoryChange,
  subCategoryOptions,
  subCategory,
  onSubCategoryChange,
  subCategoryDisabled,
  size,
  onSizeChange,
  priceBucket,
  onPriceBucketChange,
  onReset,
}: {
  categories: CategoryDto[]
  category: string
  onCategoryChange: (slug: string) => void
  subCategoryOptions: SubCategoryOption[]
  subCategory: string
  onSubCategoryChange: (slug: string) => void
  subCategoryDisabled: boolean
  size: string
  onSizeChange: (size: string) => void
  priceBucket: string
  onPriceBucketChange: (bucket: string) => void
  onReset: () => void
}) {
  return (
    // No bottom rule: it only ever spanned this group, stopping short of the Sort control
    // on the same row, so it read as an unfinished line rather than a divider. The grid
    // below already carries its own top spacing.
    <div className="flex flex-wrap items-center gap-2.5">
      <FilterSelect
        label="Category"
        value={category}
        active={category !== 'all'}
        onChange={onCategoryChange}
        options={[
          { value: 'all', label: 'All Categories' },
          ...categories.map((c) => ({ value: categoryNameToSlug(c.name), label: c.name })),
        ]}
      />
      <FilterSelect
        label="Sub Category"
        value={subCategory}
        active={subCategory !== 'all'}
        onChange={onSubCategoryChange}
        disabled={subCategoryDisabled}
        options={[
          { value: 'all', label: 'All Sub Categories' },
          ...subCategoryOptions.map((s) => ({ value: s.slug, label: s.name })),
        ]}
      />
      <FilterSelect
        label="Size"
        value={size}
        active={size !== 'all'}
        onChange={onSizeChange}
        options={[{ value: 'all', label: 'All Sizes' }, ...SIZE_OPTIONS.map((s) => ({ value: s, label: s }))]}
      />
      <FilterSelect
        label="Price"
        value={priceBucket}
        active={priceBucket !== 'all'}
        onChange={onPriceBucketChange}
        options={PRICE_BUCKETS.map((b) => ({ value: b.value, label: b.label }))}
      />
      {/*
        Matched to the selects at rest — same border colour, padding, size, weight and
        tracking — so the row reads as one set of controls instead of four light-bordered
        boxes beside one heavy black one. It stays identifiable as an action by inverting
        on hover, which no select does.
      */}
      <button
        type="button"
        onClick={onReset}
        className="border border-zinc-300 bg-white px-3.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-black transition-colors hover:border-black hover:bg-black hover:text-white"
      >
        Reset Filter
      </button>
    </div>
  )
}
