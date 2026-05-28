import { useId, useState, type ReactNode } from 'react'

function IconChevron({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

type FilterAccordionSectionProps = {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

export function FilterAccordionSection({
  title,
  defaultOpen = true,
  children,
}: FilterAccordionSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div className="border-b border-zinc-200 last:border-b-0 dark:border-zinc-800">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center justify-between gap-3 py-3.5 text-left"
      >
        <span className="type-filter-title">{title}</span>
        <IconChevron
          className={`size-4 shrink-0 text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open ? (
        <div id={panelId} className="pb-4">
          {children}
        </div>
      ) : null}
    </div>
  )
}
