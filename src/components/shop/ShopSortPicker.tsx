import { FilterSelect } from '@/components/shop/FilterSelect'
import type { SortKey } from '@/types'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: 'Featured' },
  { key: 'new-arrival', label: 'New Arrivals' },
  { key: 'bestseller', label: 'Best Selling' },
  { key: 'price-asc', label: 'Price Low to High' },
  { key: 'price-desc', label: 'Price High to Low' },
]

const SORT_KEYS = new Set<string>(SORT_OPTIONS.map((o) => o.key))

type ShopSortPickerProps = {
  sort: SortKey
  onSelect: (sort: SortKey) => void
}

/**
 * Sort control for the Shop toolbar.
 *
 * Built on the SAME `FilterSelect` the Category / Sub Category / Size / Price controls
 * use, rather than a bespoke pill with a hand-rolled dropdown panel. Sharing the
 * component — not just copying its classes — is what guarantees the five controls stay
 * identical: a change to the select's border, padding or chevron reaches all of them at
 * once, and they can no longer drift apart.
 *
 * It also means sorting now uses the platform's own listbox, so it gets native keyboard
 * handling, type-ahead and the correct mobile picker for free. The custom panel's Escape
 * handling, outside-click detection and roving selection all went with it, along with the
 * open/onOpenChange state the page had to carry on its behalf.
 */
export function ShopSortPicker({ sort, onSelect }: ShopSortPickerProps) {
  return (
    <FilterSelect
      label="Sort by"
      value={sort}
      // Highlighted like the other controls once it is off its default, so "a filter is
      // active here" reads the same way across the whole toolbar.
      active={sort !== 'popular'}
      onChange={(value) => {
        // The select can only produce these values, but the cast is checked rather than
        // asserted so an option list and this union can never silently disagree.
        if (SORT_KEYS.has(value)) onSelect(value as SortKey)
      }}
      options={SORT_OPTIONS.map((option) => ({ value: option.key, label: option.label }))}
    />
  )
}
