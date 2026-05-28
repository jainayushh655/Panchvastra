import type { Product } from '@/types'

export function normalizeGroupKey(key: string | undefined): string {
  return key?.trim().toLowerCase() ?? ''
}

/** Label under variant thumbnail on PDP. */
export function variantDisplayLabel(product: Product): string {
  const label = product.variantLabel?.trim()
  if (label) return label
  const parts = product.name.split('·').map((s) => s.trim())
  if (parts.length > 1 && parts[parts.length - 1]) return parts[parts.length - 1]!
  return product.name
}

export function getProductsInGroup(products: Product[], groupKey: string): Product[] {
  const key = normalizeGroupKey(groupKey)
  if (!key) return []
  return products.filter((p) => normalizeGroupKey(p.groupKey) === key)
}

/** Sibling variants for PDP (current product + others with same groupKey). Requires 2+ to show UI. */
export function getSiblingVariants(current: Product, catalog: Product[]): Product[] {
  const key = normalizeGroupKey(current.groupKey)
  if (!key) return []
  const group = getProductsInGroup(catalog, key)
  if (group.length < 2) return []

  const label = (p: Product) => variantDisplayLabel(p).toLowerCase()
  return [...group].sort((a, b) => {
    if (a.id === current.id) return -1
    if (b.id === current.id) return 1
    return label(a).localeCompare(label(b))
  })
}
