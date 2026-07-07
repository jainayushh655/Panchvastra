import type { Product, ProductHighlightRef } from '@/types'

/** Always appended on PDP unless already present in product data */
export const EXCHANGE_HIGHLIGHT_KEY = '7-days-exchange'

export type HighlightCatalogEntry = {
  specLabel: string
  value: string
}

export const HIGHLIGHT_CATALOG: Record<string, HighlightCatalogEntry> = {
  'oversized-fit': { specLabel: 'Fit', value: 'Oversized Fit' },
  '100-cotton': { specLabel: 'Fabric', value: '100% Cotton' },
  'bio-washed': { specLabel: 'Fabric', value: 'Bio-Washed Fabric' },
  'puff-print': { specLabel: 'Print', value: 'Puff Print' },
  'heavy-gsm': { specLabel: 'GSM', value: 'Heavy GSM' },
  'drop-shoulder': { specLabel: 'Shoulder', value: 'Drop Shoulder' },
  'premium-quality': { specLabel: 'Quality', value: 'Premium Quality' },
  unisex: { specLabel: 'Gender', value: 'Unisex' },
  breathable: { specLabel: 'Fabric', value: 'Breathable Fabric' },
  [EXCHANGE_HIGHLIGHT_KEY]: { specLabel: 'Returns', value: '7 Days Exchange Policy' },
}

export const HIGHLIGHT_CATALOG_OPTIONS = Object.entries(HIGHLIGHT_CATALOG)
  .filter(([key]) => key !== EXCHANGE_HIGHLIGHT_KEY)
  .map(([key, entry]) => ({ key, label: entry.value }))

export type ResolvedProductHighlight = {
  key: string
  specLabel: string
  value: string
}

function normalizeRef(ref: ProductHighlightRef): { key: string; specLabel?: string; value?: string } {
  if (typeof ref === 'string') {
    return { key: ref.trim() }
  }
  return {
    key: ref.key.trim(),
    specLabel: ref.label?.trim() || undefined,
    value: ref.value?.trim() || undefined,
  }
}

function inferHighlightKeys(product: Product): string[] {
  const keys: string[] = []
  const blob = [product.description, ...(product.details ?? []), ...(product.tags ?? [])]
    .join(' ')
    .toLowerCase()

  if (product.categorySlug.includes('oversized') || blob.includes('oversized')) {
    keys.push('oversized-fit')
  }
  if (blob.includes('100%') && blob.includes('cotton')) keys.push('100-cotton')
  if (blob.includes('bio-wash') || blob.includes('bio washed')) keys.push('bio-washed')
  if (blob.includes('puff')) keys.push('puff-print')
  if (blob.includes('gsm') || blob.includes('heavy')) keys.push('heavy-gsm')
  if (blob.includes('drop shoulder') || blob.includes('dropped shoulder')) {
    keys.push('drop-shoulder')
  }
  if (blob.includes('breathable')) keys.push('breathable')
  if (blob.includes('unisex')) keys.push('unisex')
  if (blob.includes('premium')) keys.push('premium-quality')

  return keys
}

function baseSpecs(product: Product): ResolvedProductHighlight[] {
  const isShorts = product.categorySlug === 'shorts'
  const isOversized = product.categorySlug.includes('oversized')
  const typeName = product.categorySlug || 'Product'

  return [
    {
      key: 'base-category',
      specLabel: 'Product Category',
      value: isShorts ? 'Bottomwear' : 'Topwear',
    },
    {
      key: 'base-type',
      specLabel: 'Product Type',
      value: typeName,
    },
    {
      key: 'base-fit',
      specLabel: 'Fit',
      value: isOversized ? 'Oversized Fit' : isShorts ? 'Relaxed Fit' : 'Regular Fit',
    },
    {
      key: 'base-closure',
      specLabel: 'Closure',
      value: 'No Closure',
    },
    {
      key: 'base-length',
      specLabel: 'Length',
      value: isShorts ? 'Above Knee' : 'Regular',
    },
  ]
}

/**
 * Resolves PDP spec rows: base product specs + catalog highlights + default exchange.
 */
export function resolveProductHighlights(product: Product): ResolvedProductHighlight[] {
  const rawRefs: ProductHighlightRef[] =
    product.highlights?.length ? product.highlights : inferHighlightKeys(product)

  const byLabel = new Map<string, ResolvedProductHighlight>()

  for (const row of baseSpecs(product)) {
    byLabel.set(row.specLabel, row)
  }

  for (const ref of rawRefs) {
    const { key, specLabel: specOverride, value: valueOverride } = normalizeRef(ref)
    if (!key || key === EXCHANGE_HIGHLIGHT_KEY) continue

    const catalog = HIGHLIGHT_CATALOG[key]
    if (!catalog && !valueOverride) continue

    const specLabel = specOverride ?? catalog?.specLabel ?? 'Highlight'
    const value = valueOverride ?? catalog?.value ?? key

    byLabel.set(specLabel, { key, specLabel, value })
  }

  const exchange = HIGHLIGHT_CATALOG[EXCHANGE_HIGHLIGHT_KEY]
  if (![...byLabel.values()].some((r) => r.key === EXCHANGE_HIGHLIGHT_KEY)) {
    byLabel.set(exchange.specLabel, {
      key: EXCHANGE_HIGHLIGHT_KEY,
      specLabel: exchange.specLabel,
      value: exchange.value,
    })
  }

  return Array.from(byLabel.values())
}

export function toggleHighlightKey(current: string[] | undefined, key: string): string[] {
  const list = current ?? []
  if (list.includes(key)) return list.filter((k) => k !== key)
  return [...list, key]
}
