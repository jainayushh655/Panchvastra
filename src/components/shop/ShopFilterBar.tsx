import { FilterSelect } from '@/components/shop/FilterSelect'
import { categoryNameToSlug } from '@/lib/categorySlug'
import type { CategoryDto } from '@/types/api/CategoryDto'

/**
 * Fixed apparel size scale — the product LIST endpoint doesn't expose a
 * "sizes available" facet to derive this from, and there's no such listing
 * endpoint either. The selection itself is genuinely backend-filtered via
 * the verified-real `size` query param on `/v1/products_management/`.
 */
export const SIZE_OPTIONS = ['S', 'M', 'L', 'XL', 'XXL']

type PriceBucket = { value: string; label: string; min: number | null; max: number | null }

/**
 * The backend does not support server-side price filtering (min_price/
 * max_price/price_min/price_max were all verified as silently ignored), so
 * price stays a client-side filter — only the presentation changes from a
 * slider to a dropdown. Buckets resolve to the same `min`/`max` URL params
 * the existing filtering logic already reads.
 */
export const PRICE_BUCKETS: PriceBucket[] = [
  { value: 'all', label: 'All Prices', min: null, max: null },
  { value: 'under-1000', label: 'Under ₹1,000', min: null, max: 999 },
  { value: '1000-1500', label: '₹1,000 – ₹1,500', min: 1000, max: 1500 },
  { value: '1500-2000', label: '₹1,500 – ₹2,000', min: 1500, max: 2000 },
  { value: '2000-plus', label: '₹2,000+', min: 2000, max: null },
]

export function priceBucketFromRange(min: number | null, max: number | null): string {
  const hit = PRICE_BUCKETS.find((b) => b.min === min && b.max === max)
  return hit?.value ?? 'all'
}

export function priceRangeFromBucket(value: string): { min: number | null; max: number | null } {
  const bucket = PRICE_BUCKETS.find((b) => b.value === value)
  return { min: bucket?.min ?? null, max: bucket?.max ?? null }
}

export type SubCategoryOption = { slug: string; name: string; id: number }

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
    <div className="flex flex-wrap items-center gap-2.5 border-b border-zinc-200 pb-6">
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
      <button
        type="button"
        onClick={onReset}
        className="ml-auto border border-black bg-white px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-black hover:text-white"
      >
        Reset Filter
      </button>
    </div>
  )
}
