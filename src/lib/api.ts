import type { CartItem, CategorySlug, Product, ShowcaseHighlight, SortKey } from '@/types'
import axios from 'axios'

/** Wired for prod: `http.get(import.meta.env.VITE_API_URL + '/catalog')` */
export const http = axios.create({
  timeout: 15_000,
  baseURL: import.meta.env.VITE_API_URL ?? '',
})

export type CatalogFilterParams = {
  category?: CategorySlug | 'all'
  q?: string
  sizes?: string[]
  minPrice?: number
  maxPrice?: number
  sort?: SortKey
}

function isDealProduct(p: Product) {
  return (
    (p.salePct != null && p.salePct > 0) ||
    (p.compareAtPrice != null && p.compareAtPrice > p.price)
  )
}

/** Admin showcase tag first; legacy flags when no tag is set (same rules as home tabs). */
export function matchesShowcaseHighlight(p: Product, highlight: ShowcaseHighlight): boolean {
  if (p.showcaseHighlight) return p.showcaseHighlight === highlight
  switch (highlight) {
    case 'trending':
      return Boolean(p.trending)
    case 'newarrival':
      return Boolean(p.isNew)
    case 'hotdeals':
      return isDealProduct(p)
    case 'bestseller':
      return false
  }
}

/** Filter + sort catalog products (used by shop page; keep in sync with getProducts). */
export function filterCatalogProducts(list: Product[], opts: CatalogFilterParams = {}) {
  let out = [...list]

  if (opts.category && opts.category !== 'all') {
    out = out.filter((p) => p.categorySlug === opts.category)
  }

  const q = opts.q?.trim().toLowerCase()
  if (q) {
    out = out.filter((p) => {
      const nameLow = (p.name ?? '').toLowerCase()
      const slugLow = (p.slug ?? '').toLowerCase()
      const tags = p.tags ?? []
      return (
        nameLow.includes(q) ||
        tags.some((t) => String(t ?? '').toLowerCase().includes(q)) ||
        slugLow.includes(q.replace(/\s+/g, '-'))
      )
    })
  }

  if (opts.sizes?.length) {
    out = out.filter((p) => (p.sizes ?? []).some((s) => opts.sizes!.includes(s)))
  }

  if (opts.minPrice != null) out = out.filter((p) => p.price >= opts.minPrice!)
  if (opts.maxPrice != null) out = out.filter((p) => p.price <= opts.maxPrice!)

  switch (opts.sort ?? 'popular') {
    case 'price-asc':
      out.sort((a, b) => a.price - b.price)
      break
    case 'price-desc':
      out.sort((a, b) => b.price - a.price)
      break
    case 'new-arrival':
      out = out.filter((p) => matchesShowcaseHighlight(p, 'newarrival'))
      out.sort((a, b) => b.popularity - a.popularity)
      break
    case 'bestseller':
      out = out.filter((p) => matchesShowcaseHighlight(p, 'bestseller'))
      out.sort((a, b) => b.reviewCount - a.reviewCount)
      break
    default:
      out.sort((a, b) => b.popularity - a.popularity)
  }

  return out
}

export function cartLineKey(productId: string, size: string, color?: string) {
  const c = color?.trim()
  if (c) return `${productId}::${size}::${c}`
  return `${productId}::${size}`
}

export function productToCartItem(
  product: Product,
  size: string,
  quantity: number,
  color?: string,
): CartItem {
  const c = color?.trim()
  return {
    key: cartLineKey(product.id, size, c),
    productId: product.id,
    slug: product.slug,
    name: product.name,
    image: product.images[0],
    size,
    ...(c ? { color: c } : {}),
    price: product.price,
    quantity,
  }
}
