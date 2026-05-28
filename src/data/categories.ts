import type { CategoryDef } from '@/types'

export const CATEGORIES: CategoryDef[] = [
  { slug: 'regular-tee', label: 'Regular T-shirts', shortLabel: 'Regular' },
  { slug: 'oversized-tee', label: 'Oversized T-shirts', shortLabel: 'Oversized' },
  { slug: 'shorts', label: 'Shorts', shortLabel: 'Shorts' },
]

export const categoryLabel = (slug: string) =>
  CATEGORIES.find((c) => c.slug === slug)?.label ?? slug
