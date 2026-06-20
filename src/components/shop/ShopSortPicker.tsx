import { useEffect, useId, useRef } from 'react'
import type { SortKey } from '@/types'
import { shopToolbarButtonClass, shopToolbarLabelClass } from '@/components/shop/shopToolbar'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'popular', label: 'Featured' },
  { key: 'new-arrival', label: 'New Arrivals' },
  { key: 'bestseller', label: 'Best Selling' },
  { key: 'price-asc', label: 'Price Low to High' },
  { key: 'price-desc', label: 'Price High to Low' },
]

function sortTriggerLabel(sort: SortKey): string {
  const row = SORT_OPTIONS.find((o) => o.key === sort)
  return (row?.label ?? 'Featured').toUpperCase()
}

function IconSortMenu({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 6h12M4 12h8M4 18h16" strokeLinecap="round" />
      <path d="M18 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type ShopSortPickerProps = {
  sort: SortKey
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (sort: SortKey) => void
}

export function ShopSortPicker({ sort, open, onOpenChange, onSelect }: ShopSortPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onOpenChange])

  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (panelRef.current?.contains(t)) return
      if (triggerRef.current?.contains(t)) return
      onOpenChange(false)
    }
    document.addEventListener('pointerdown', onPointer)
    return () => document.removeEventListener('pointerdown', onPointer)
  }, [open, onOpenChange])

  return (
    <div className="relative w-fit max-w-full">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        onClick={() => onOpenChange(!open)}
        className={shopToolbarButtonClass}
      >
        <IconSortMenu className="h-4 w-4 shrink-0 text-zinc-600 dark:text-zinc-300" />
        <span className={shopToolbarLabelClass}>
          Sort by : <span className="text-zinc-600 dark:text-zinc-300">{sortTriggerLabel(sort)}</span>
        </span>
      </button>

      {open ? (
        <div
          ref={panelRef}
          id={listId}
          role="listbox"
          aria-label="Sort by"
          className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          <ul className="py-1">
            {SORT_OPTIONS.map((opt) => {
              const selected = sort === opt.key
              return (
                <li key={opt.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      onSelect(opt.key)
                      onOpenChange(false)
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-2 text-left font-sans text-xs font-medium leading-snug text-zinc-800 transition-colors hover:bg-zinc-50 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                        selected
                          ? 'border-[#b07f2e] bg-[#b07f2e] text-white dark:border-[#d6b36d] dark:bg-[#d6b36d]'
                          : 'border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-900'
                      }`}
                    >
                      {selected ? <IconCheck className="h-2.5 w-2.5" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">{opt.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
