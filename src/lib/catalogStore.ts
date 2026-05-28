import { CMS_STORAGE_KEYS } from '@/cms/registry'
import { CATEGORIES } from '@/data/categories'
import { MOCK_PRODUCTS } from '@/data/mockProducts'
import { adminSessionOk, getAdminApiToken } from '@/lib/adminAuth'
import { fetchCatalogFromApi, saveCatalogToApi } from '@/lib/catalogApi'
import type { CategoryDef, Product } from '@/types'
import { defaultHeroSlides, normalizeHomepageContent } from '@/lib/homepageHero'
import type { HomepageContent } from '@/types/homepage'
import type { OrderLogEntry } from '@/types/orderLog'

export type CatalogSnapshot = {
  products: Product[]
  categories: CategoryDef[]
  homepage: HomepageContent
  revision: number
}

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

export function defaultHomepage(): HomepageContent {
  return {
    heroEyebrow: 'Gen Z · India-first',
    heroTitle: 'Built for fits that live on feed & off it.',
    heroSub:
      'PANCHVASTRA is modular streetwear: regular tees, oversized silhouettes, and shorts — with room to grow into whatever the algorithm wants next.',
    heroSlides: defaultHeroSlides(),
    featuredSectionTitle: 'Featured drops',
    trendingSectionTitle: 'Trending now',
    featuredTiles: [
      {
        slug: 'oversized-tee',
        title: 'Oversized',
        blurb: 'Drop shoulders & longline drape',
        badge: 'Line',
        bgClass: 'from-violet-900/30 to-zinc-900',
      },
      {
        slug: 'regular-tee',
        title: 'Regular',
        blurb: 'Daily rotation staples',
        badge: 'Core',
        bgClass: 'from-orange-900/25 to-zinc-900',
      },
      {
        slug: 'shorts',
        title: 'Shorts',
        blurb: 'Tech fleece & swim hybrids',
        badge: 'Line',
        bgClass: 'from-emerald-900/25 to-zinc-900',
      },
    ],
    banners: {
      sale: {
        eyebrow: 'Sale',
        title: 'End of season — up to 25% off',
        sub: 'Core staples & shorts while stock lasts.',
        cta: 'Shop sale →',
        link: '/shop',
      },
      arrivals: {
        eyebrow: 'New arrivals',
        title: 'Acid wash + neon mist',
        sub: "Micro-drops that won't restock.",
        cta: 'See new →',
        link: '/shop?q=acid',
      },
    },
    newsletterTitle: 'Join the list',
    newsletterSub: 'Early access to collabs & restocks. No spam — we respect the inbox.',
  }
}

function seedSnapshot(): CatalogSnapshot {
  return {
    products: clone(MOCK_PRODUCTS),
    categories: clone(CATEGORIES),
    homepage: defaultHomepage(),
    revision: 0,
  }
}

function readCatalogLs(): CatalogSnapshot | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const raw = localStorage.getItem(CMS_STORAGE_KEYS.catalog)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CatalogSnapshot
    if (!parsed?.products?.length) return null
    return parsed
  } catch {
    return null
  }
}

function mergeLsCatalog(parsed: CatalogSnapshot): CatalogSnapshot {
  const needed = seedSnapshot()
  return {
    ...parsed,
    products: parsed.products ?? needed.products,
    homepage: normalizeHomepageContent(parsed.homepage, needed.homepage),
    categories: parsed.categories?.length ? parsed.categories : needed.categories,
    revision: parsed.revision ?? 0,
  }
}

function loadSnapshot(): CatalogSnapshot {
  const fromLs = typeof window !== 'undefined' && window.localStorage ? readCatalogLs() : null
  if (fromLs) return mergeLsCatalog(fromLs)
  return seedSnapshot()
}

let snapshot: CatalogSnapshot = loadSnapshot()
let orderLogCached: OrderLogEntry[] | null = null

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => {
    l()
  })
}

/** Re-read localStorage when another tab edits catalog, or when LS is newer than memory. */
export function syncCatalogFromLocalStorage(): void {
  if (typeof window === 'undefined') return
  const fromLs = readCatalogLs()
  if (!fromLs) return

  const merged = mergeLsCatalog(fromLs)
  const lsRev = merged.revision ?? 0
  const memRev = snapshot.revision ?? 0
  const lsCount = merged.products?.length ?? 0
  const memCount = snapshot.products?.length ?? 0
  if (lsRev > memRev || lsCount !== memCount || JSON.stringify(snapshot.products.map((p) => p.id)) !== JSON.stringify(merged.products.map((p) => p.id))) {
    snapshot = merged
    emit()
  }
}

function applyRemoteCatalog(remote: CatalogSnapshot) {
  snapshot = mergeLsCatalog(remote)
  persistCatalogLocal()
  emit()
}

let apiPushTimer: ReturnType<typeof setTimeout> | null = null

function persistCatalogLocal() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    localStorage.setItem(CMS_STORAGE_KEYS.catalog, JSON.stringify(snapshot))
  } catch {
    /* quota / privacy mode */
  }
}

function scheduleCatalogApiPush() {
  if (typeof window === 'undefined' || !adminSessionOk()) return
  if (apiPushTimer) clearTimeout(apiPushTimer)
  apiPushTimer = setTimeout(() => {
    apiPushTimer = null
    void saveCatalogToApi(snapshot, getAdminApiToken())
  }, 600)
}

/** Load shared catalog from Vercel JSON API (source of truth in production). */
export async function hydrateCatalogFromApi(): Promise<void> {
  const remote = await fetchCatalogFromApi()
  if (remote?.products?.length) applyRemoteCatalog(remote)
}

/** Refresh when user returns to the tab (e.g. admin edited on another device). */
export async function refreshCatalogFromApi(): Promise<void> {
  await hydrateCatalogFromApi()
}

function persistCatalog() {
  persistCatalogLocal()
  scheduleCatalogApiPush()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== CMS_STORAGE_KEYS.catalog || !e.newValue) return
    try {
      const parsed = JSON.parse(e.newValue) as CatalogSnapshot
      if (parsed?.products?.length) {
        snapshot = mergeLsCatalog(parsed)
        emit()
      }
    } catch {
      /* */
    }
  })
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncCatalogFromLocalStorage()
      void refreshCatalogFromApi()
    }
  })
}

function persistOrderLog(log: OrderLogEntry[]) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    localStorage.setItem(CMS_STORAGE_KEYS.orderLog, JSON.stringify(log))
  } catch {
    /* */
  }
}

function readOrderLog(): OrderLogEntry[] {
  if (orderLogCached) return orderLogCached
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      orderLogCached = []
      return orderLogCached
    }
    const raw = localStorage.getItem(CMS_STORAGE_KEYS.orderLog)
    orderLogCached = raw ? JSON.parse(raw) : []
  } catch {
    orderLogCached = []
  }
  return orderLogCached!
}

/** Subscribe storefront + admin UI to CMS mutations */
export function subscribeCatalog(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getCatalogSnapshot(): CatalogSnapshot {
  return snapshot
}

export function getCategoriesSnapshot(): CategoryDef[] {
  return snapshot.categories
}

/** PDP / cart color chips when a product has no `colors` in CMS yet */
const DEFAULT_PRODUCT_COLORS = ['Black', 'White', 'Charcoal', 'Navy', 'Olive'] as const

export function getProductsSnapshot(): Product[] {
  return snapshot.products.map((p) => {
    if (p.groupKey?.trim()) {
      const colors = Array.isArray(p.colors) ? p.colors.filter(Boolean) : []
      return { ...p, colors }
    }
    if (Array.isArray(p.colors)) {
      if (p.colors.length > 0) return p
      return { ...p, colors: [] }
    }
    return { ...p, colors: [...DEFAULT_PRODUCT_COLORS] }
  })
}

export function getHomepageSnapshot(): HomepageContent {
  return snapshot.homepage
}

export function slugify(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function upsertProduct(next: Product) {
  snapshot = {
    ...snapshot,
    revision: snapshot.revision + 1,
    products: (() => {
      const ix = snapshot.products.findIndex((p) => p.id === next.id)
      const copy = [...snapshot.products]
      if (ix === -1) copy.push(next)
      else copy[ix] = next
      return copy
    })(),
  }
  persistCatalog()
  emit()
}

export function deleteProductById(id: string) {
  snapshot = {
    ...snapshot,
    revision: snapshot.revision + 1,
    products: snapshot.products.filter((p) => p.id !== id),
  }
  persistCatalog()
  emit()
}

export function setCategoriesBulk(next: CategoryDef[]) {
  snapshot = {
    ...snapshot,
    revision: snapshot.revision + 1,
    categories: next,
  }
  persistCatalog()
  emit()
}

export function setHomepageBulk(next: HomepageContent) {
  snapshot = {
    ...snapshot,
    revision: snapshot.revision + 1,
    homepage: next,
  }
  persistCatalog()
  emit()
}

export async function resetCatalogToSeed() {
  snapshot = seedSnapshot()
  persistCatalogLocal()
  orderLogCached = []
  persistOrderLog([])
  emit()
  if (adminSessionOk()) {
    await saveCatalogToApi(snapshot, getAdminApiToken())
  }
}

/** Newest-first (admin / review). */
export function getOrderLog(): OrderLogEntry[] {
  return readOrderLog().slice()
}

export function appendOrderLog(entry: OrderLogEntry) {
  const log = readOrderLog()
  log.unshift(entry)
  orderLogCached = log
  persistOrderLog(log)
  emit()
}

export function updateOrderStatus(orderId: string, status: import('@/types').Order['status']) {
  const log = readOrderLog()
  const ix = log.findIndex((x) => x.order.id === orderId)
  if (ix >= 0) {
    log[ix] = {
      ...log[ix],
      order: {
        ...log[ix].order,
        status,
      },
    }
    orderLogCached = log
    persistOrderLog(log)
    emit()
  }
}
