import { FilterAccordionSection } from '@/components/shop/FilterAccordionSection'
import { DualPriceRange } from '@/components/shop/DualPriceRange'

type PriceFilterSectionProps = {
  boundMin: number
  boundMax: number
  minUrl: number | null
  maxUrl: number | null
  onCommit: (min: number | null, max: number | null) => void
}

export function PriceFilterSection({
  boundMin,
  boundMax,
  minUrl,
  maxUrl,
  onCommit,
}: PriceFilterSectionProps) {
  return (
    <FilterAccordionSection title="Price" defaultOpen>
      <p className="type-label mb-3 normal-case tracking-normal">Selected price range</p>
      <DualPriceRange
        boundMin={boundMin}
        boundMax={boundMax}
        minUrl={minUrl}
        maxUrl={maxUrl}
        onCommit={onCommit}
      />
    </FilterAccordionSection>
  )
}
