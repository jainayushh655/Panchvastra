/** Canonical slugs seeded in data; admins may add future slugs (stored in CMS catalog). */
export type CategorySlug = string

export interface CategoryDef {
  slug: CategorySlug
  label: string
  shortLabel: string
}

export interface ProductReview {
  id: string
  author: string
  rating: number
  comment: string
  date: string
}

/** Catalog key or custom spec row: `label` = spec label, `value` = spec value */
export type ProductHighlightRef = string | { key: string; label?: string; value?: string }

/** Which home “Curated for you” tab this product is pinned to (admin picks at most one). */
export type ShowcaseHighlight = 'trending' | 'bestseller' | 'newarrival' | 'hotdeals'

export interface Product {
  id: string
  slug: string
  name: string
  categorySlug: CategorySlug
  price: number
  compareAtPrice?: number
  sizes: string[]
  /**
   * Links separate catalog products as PDP variants (Amazon-style).
   * Products sharing the same key appear as selectable thumbnails on the detail page.
   */
  groupKey?: string
  /** Short label under the variant thumbnail (e.g. "Black"). Falls back to name. */
  variantLabel?: string
  /** When empty / omitted, PDP hides color chips unless `groupKey` variants are used. */
  colors?: string[]
  images: string[]
  /** Secondary image shown on shop grid hover (admin upload or URL). */
  hoverImage?: string
  description: string
  details: string[]
  /** PDP key highlights — catalog keys and/or `{ key, label }` from API/CMS */
  highlights?: ProductHighlightRef[]
  rating: number
  reviewCount: number
  popularity: number
  tags: string[]
  trending?: boolean
  isNew?: boolean
  salePct?: number
  /** Admin: appears on the matching home tab only. */
  showcaseHighlight?: ShowcaseHighlight
  /** Optional size-to-variant map used by some product mappers. */
  sizeVariantMap?: Record<string, string | number>
}

export interface CartItem {
  readonly key: string
  productId: string
  slug: string
  name: string
  image: string
  size: string
  color?: string
  price: number
  quantity: number
}

export type SortKey =
  | 'popular'
  | 'new-arrival'
  | 'bestseller'
  | 'price-asc'
  | 'price-desc'

export interface OrderItem {
  productId: string
  name: string
  size: string
  color?: string
  quantity: number
  price: number
}

export interface Order {
  id: string
  date: string
  total: number
  status: 'delivered' | 'shipped' | 'processing'
  items: OrderItem[]
}

export interface Address {
  email: string
  fullName: string
  line1: string
  line2: string
  city: string
  state: string
  pincode: string
  phone: string
}
