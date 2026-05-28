import { Link } from 'react-router-dom'
import { variantDisplayLabel } from '@/lib/productVariants'
import type { Product } from '@/types'

type Props = {
  current: Product
  variants: Product[]
}

export function ProductVariantPicker({ current, variants }: Props) {
  if (variants.length < 2) return null

  return (
    <div>
      <p className="font-sans text-sm font-semibold text-zinc-900 dark:text-white">Similar variants</p>
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
        Choose a style or color — each option is a full product with its own images and details.
      </p>
      <ul className="mt-4 flex flex-wrap gap-3" role="list">
        {variants.map((v) => {
          const selected = v.id === current.id
          const label = variantDisplayLabel(v)
          return (
            <li key={v.id}>
              <Link
                to={`/product/${v.slug}`}
                aria-current={selected ? 'page' : undefined}
                className={`flex w-[76px] flex-col overflow-hidden rounded-xl border-2 bg-white transition-shadow dark:bg-zinc-900 ${
                  selected
                    ? 'border-orange-500 shadow-md ring-2 ring-orange-500/30'
                    : 'border-zinc-200 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-500'
                }`}
              >
                <div className="aspect-[4/5] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  <img
                    src={v.images[0]}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
                <span
                  className={`px-1.5 py-2 text-center font-sans text-[11px] font-semibold leading-tight ${
                    selected ? 'text-orange-600 dark:text-orange-400' : 'text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  {label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
