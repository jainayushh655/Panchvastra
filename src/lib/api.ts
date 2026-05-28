import type { CartItem, CategorySlug, Product, SortKey } from '@/types'
import { getCategoriesSnapshot, getProductsSnapshot } from '@/lib/catalogStore'
import { getSiblingVariants } from '@/lib/productVariants'
import axios from 'axios'

/** Wired for prod: `http.get(import.meta.env.VITE_API_URL + '/catalog')` */
export const http = axios.create({
  timeout: 15_000,
  baseURL: import.meta.env.VITE_API_URL ?? '',
})

const delay = (ms = 220) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

function filterSort(
  list: Product[],
  opts: {
    category?: CategorySlug | 'all'
    q?: string
    sizes?: string[]
    minPrice?: number
    maxPrice?: number
    sort?: SortKey
  },
) {
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
        tags.some((t) => (String(t ?? '')).toLowerCase().includes(q)) ||
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
      out.sort((a, b) => {
        const an = a.isNew ? 1 : 0
        const bn = b.isNew ? 1 : 0
        if (bn !== an) return bn - an
        return b.popularity - a.popularity
      })
      break
    case 'bestseller':
      out.sort((a, b) => b.reviewCount - a.reviewCount)
      break
    default:
      out.sort((a, b) => b.popularity - a.popularity)
  }

  return out
}

/** Reads live snapshot from CMS store — replace with HTTP when backend exists */
export const catalogApi = {
  async getProducts(params?: {
    category?: CategorySlug | 'all'
    q?: string
    sizes?: string[]
    minPrice?: number
    maxPrice?: number
    sort?: SortKey
  }) {
    await delay()
    const products = getProductsSnapshot()
    const categories = getCategoriesSnapshot()
    const data = filterSort(products, params ?? {})
    return {
      products: data,
      categories,
      meta: { total: data.length },
    }
  },

  async getTrending(limit = 6) {
    await delay()
    const items = [...getProductsSnapshot()]
      .sort((a, b) => b.popularity - a.popularity)
      .slice(0, limit)
    return { products: items }
  },

  /** Home showcase row: admin-tagged products first, then legacy rules to fill up to three. */
  async getHomeShowcase(filter: 'trending' | 'bestseller' | 'newarrival' | 'hotdeals', limit = 3) {
    await delay()
    const list = [...getProductsSnapshot()]
    const byPop = () => [...list].sort((a, b) => b.popularity - a.popularity)

    const isDeal = (p: Product) =>
      (p.salePct != null && p.salePct > 0) ||
      (p.compareAtPrice != null && p.compareAtPrice > p.price)

    const fallbackOrdered = (): Product[] => {
      switch (filter) {
        case 'trending':
          return list.filter((p) => p.trending).sort((a, b) => b.popularity - a.popularity)
        case 'bestseller':
          return [...list].sort((a, b) => b.reviewCount - a.reviewCount)
        case 'newarrival':
          return list.filter((p) => p.isNew).sort((a, b) => b.popularity - a.popularity)
        case 'hotdeals':
          return list.filter(isDeal).sort((a, b) => (b.salePct ?? 0) - (a.salePct ?? 0))
        default:
          return byPop()
      }
    }

    const tagged = list.filter((p) => p.showcaseHighlight === filter).sort((a, b) => b.popularity - a.popularity)
    const seen = new Set(tagged.map((p) => p.id))
    const out = [...tagged]
    for (const p of fallbackOrdered()) {
      if (out.length >= limit) break
      if (!seen.has(p.id)) {
        out.push(p)
        seen.add(p.id)
      }
    }
    if (out.length < limit) {
      for (const p of byPop()) {
        if (out.length >= limit) break
        if (!seen.has(p.id)) {
          out.push(p)
          seen.add(p.id)
        }
      }
    }
    return { products: out.slice(0, limit) }
  },

  async getBySlug(slug: string): Promise<Product | null> {
    await delay()
    return getProductsSnapshot().find((p) => p.slug === slug) ?? null
  },

  async getSiblingVariants(slug: string): Promise<Product[]> {
    await delay()
    const product = getProductsSnapshot().find((p) => p.slug === slug)
    if (!product) return []
    return getSiblingVariants(product, getProductsSnapshot())
  },

  async getSuggested(productId: string, limit = 4) {
    await delay()
    const list = getProductsSnapshot()
    const self = list.find((p) => p.id === productId)
    if (!self) return []
    const same = list.filter((p) => p.categorySlug === self.categorySlug && p.id !== self.id)
    return same.slice(0, limit)
  },
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
