import { FilterAccordionSection } from '@/components/shop/FilterAccordionSection'

const FILTER_SIZES = ['S', 'M', 'L', 'XL', 'XXL'] as const

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3.5 8.5l3 3 6-7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function FilterCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] border ${
        checked
          ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
          : 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900'
      }`}
      aria-hidden
    >
      {checked ? <IconCheck className="h-3 w-3" /> : null}
    </span>
  )
}

type SizeFilterDropdownProps = {
  selected: string[]
  onChange: (sizes: string[]) => void
}

export function SizeFilterDropdown({ selected, onChange }: SizeFilterDropdownProps) {
  const validSelected = selected.filter((s) =>
    (FILTER_SIZES as readonly string[]).includes(s),
  )

  const toggleSize = (size: string) => {
    if (validSelected.includes(size)) {
      onChange(validSelected.filter((s) => s !== size))
    } else {
      const order = FILTER_SIZES as readonly string[]
      onChange(
        [...validSelected, size].sort((a, b) => order.indexOf(a) - order.indexOf(b)),
      )
    }
  }

  return (
    <FilterAccordionSection title="Size" defaultOpen>
      <ul className="space-y-0" role="group" aria-label="Filter by size">
        {FILTER_SIZES.map((size) => {
          const checked = validSelected.includes(size)
          return (
            <li key={size}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={() => toggleSize(size)}
                className="flex w-full items-center justify-between gap-3 py-2.5 text-left font-sans text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
              >
                <span>{size}</span>
                <FilterCheckbox checked={checked} />
              </button>
            </li>
          )
        })}
      </ul>
    </FilterAccordionSection>
  )
}
