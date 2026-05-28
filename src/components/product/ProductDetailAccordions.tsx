import { useId, useState, type ReactNode } from 'react'
import type { Product } from '@/types'

const RETURN_POLICY = [
  'Returns and exchanges are accepted within 15 days of delivery.',
  'Items must be unused, unwashed, and returned with original tags and packaging.',
  'Exchanges for size or colour are subject to stock availability.',
  'Refunds are processed to your original payment method after quality check (typically 5–7 business days).',
  'Sale or final-clearance items may be exchange-only unless defective.',
]

function IconChevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`size-5 shrink-0 text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
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

function IconDescription() {
  return (
    <svg className="size-5 text-zinc-600 dark:text-zinc-400" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

function IconReturns() {
  return (
    <svg className="size-5 text-zinc-600 dark:text-zinc-400" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 14L4 9l5-5M4 9h11a7 7 0 017 7v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type AccordionRowProps = {
  icon: ReactNode
  title: string
  subtitle: string
  children: ReactNode
  defaultOpen?: boolean
  showDivider?: boolean
}

function AccordionRow({
  icon,
  title,
  subtitle,
  children,
  defaultOpen = false,
  showDivider = true,
}: AccordionRowProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div className={showDivider ? 'border-b border-zinc-200 dark:border-zinc-800' : ''}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((x) => !x)}
        className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40"
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800"
          aria-hidden
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-sans text-sm font-semibold text-zinc-900 dark:text-white">{title}</span>
          <span className="mt-0.5 block font-sans text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</span>
        </span>
        <IconChevron open={open} />
      </button>
      {open ? (
        <div id={panelId} className="border-t border-zinc-100 px-4 pb-5 pt-1 dark:border-zinc-800/80">
          <div className="pl-14">{children}</div>
        </div>
      ) : null}
    </div>
  )
}

type ProductDetailAccordionsProps = {
  product: Product
  className?: string
}

export function ProductDetailAccordions({ product, className = '' }: ProductDetailAccordionsProps) {
  const hasDescription = Boolean(product.description?.trim())
  const hasDetails = product.details.length > 0
  const showDescription = hasDescription || hasDetails

  return (
    <section className={`mt-6 ${className}`} aria-label="Product information">
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        {showDescription ? (
          <AccordionRow
            icon={<IconDescription />}
            title="Product Description"
            subtitle="Manufacture, Care and Fit"
            defaultOpen={false}
          >
            {hasDescription ? (
              <p className="font-sans text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {product.description}
              </p>
            ) : null}
            {hasDetails ? (
              <ul
                className={`list-inside list-disc space-y-1.5 font-sans text-sm text-zinc-600 dark:text-zinc-400 ${hasDescription ? 'mt-4' : ''}`}
              >
                {product.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            ) : null}
          </AccordionRow>
        ) : null}

        <AccordionRow
          icon={<IconReturns />}
          title="15 Days Returns & Exchange"
          subtitle="Know about return & exchange policy"
          showDivider={false}
        >
          <ul className="list-inside list-disc space-y-2 font-sans text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {RETURN_POLICY.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </AccordionRow>
      </div>
    </section>
  )
}
