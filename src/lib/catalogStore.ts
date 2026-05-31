import { CMS_STORAGE_KEYS } from '@/cms/registry'
import { CATEGORIES } from '@/data/categories'
import { MOCK_PRODUCTS } from '@/data/mockProducts'
import { adminSessionOk, getAdminApiToken } from '@/lib/adminAuth'
import { fetchCatalogFromApiDetailed, saveCatalogToApi, type SaveCatalogResult } from '@/lib/catalogApi'
import type { CategoryDef, Product } from '@/types'
import { defaultHomepage as buildDefaultHomepage } from '@/lib/defaultHomepage'
import { normalizeHomepageContent } from '@/lib/homepageHero'
import type { HomepageContent } from '@/types/homepage'
import type { OrderLogEntry } from '@/types/orderLog'

export type CatalogSnapshot = {
  products: Product[]
  categories: CategoryDef[]
  homepage: HomepageContent
  revision: number
}

export const CATALOG_SYNC_EVENT = 'panchvastra:catalog-sync'

export type CatalogSyncDetail = SaveCatalogResult

const LOG_PREFIX = '[panchvastra/catalog]'

function clone<T>(x: T): T {
  return JSON.parse(JSON.stringify(x)) as T
}

export { defaultHomepage } from '@/lib/defaultHomepage'

function seedSnapshot(): CatalogSnapshot {
  return {
    products: clone(MOCK_PRODUCTS),
    categories: clone(CATEGORIES),
    homepage: buildDefaultHomepage(),
    revision: 0,
  }
}

function normalizeSnapshot(raw: CatalogSnapshot): CatalogSnapshot {
  const fallback = seedSnapshot()
  return {
    products: Array.isArray(raw.products) ? raw.products : fallback.products,
    categories: raw.categories?.length ? raw.categories : fallback.categories,
    homepage: normalizeHomepageContent(raw.homepage, fallback.homepage),
    revision: typeof raw.revision === 'number' ? raw.revision : 0,
  }
}

function readCatalogLs(): CatalogSnapshot | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    const raw = localStorage.getItem(CMS_STORAGE_KEYS.catalog)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CatalogSnapshot
    if (!parsed || !Array.isArray(parsed.products)) return null
    return normalizeSnapshot(parsed)
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to read localStorage cache`, err)
    return null
  }
}

/** Offline cache only — API/Blob is the source of truth on startup. */
function loadSnapshot(): CatalogSnapshot {
  if (typeof window === 'undefined') return seedSnapshot()
  const seed = seedSnapshot()
  return { ...seed, products: [], revision: 0 }
}

let snapshot: CatalogSnapshot = loadSnapshot()
let orderLogCached: OrderLogEntry[] | null = null
let hasHydratedFromApi = false
let lastApiPushFailed = false

export function isCatalogHydrated(): boolean {
  return hasHydratedFromApi
}

const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((l) => {
    l()
  })
}

function dispatchSyncEvent(detail: CatalogSyncDetail) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent<CatalogSyncDetail>(CATALOG_SYNC_EVENT, { detail }))
}

/** Re-read localStorage when another tab edits catalog on the same device. */
export function syncCatalogFromLocalStorage(): void {
  if (typeof window === 'undefined' || !hasHydratedFromApi) return
  const fromLs = readCatalogLs()
  if (!fromLs) return

  const lsRev = fromLs.revision ?? 0
  const memRev = snapshot.revision ?? 0
  if (lsRev > memRev) {
    snapshot = fromLs
    emit()
    console.info(`${LOG_PREFIX} Applied newer localStorage cache from another tab`, { revision: lsRev })
  }
}

function applyRemoteCatalog(remote: CatalogSnapshot) {
  snapshot = normalizeSnapshot(remote)
  persistCatalogLocal()
  emit()
}

let apiPushTimer: ReturnType<typeof setTimeout> | null = null

function persistCatalogLocal() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return
    localStorage.setItem(CMS_STORAGE_KEYS.catalog, JSON.stringify(snapshot))
    lastApiPushFailed = false
  } catch (err) {
    console.error(`${LOG_PREFIX} localStorage write failed (quota or privacy mode)`, err)
  }
}

async function pushCatalogToApi(): Promise<SaveCatalogResult> {
  const result = await saveCatalogToApi(snapshot, getAdminApiToken())
  dispatchSyncEvent(result)
  if (result.ok) {
    lastApiPushFailed = false
    if (result.revision > snapshot.revision) {
      snapshot = { ...snapshot, revision: result.revision }
      persistCatalogLocal()
      emit()
    }
  } else {
    lastApiPushFailed = true
    console.error(`${LOG_PREFIX} Save to API failed — changes exist locally only until save succeeds`, result)
  }
  return result
}

function scheduleCatalogApiPush() {
  if (typeof window === 'undefined' || !adminSessionOk()) return
  if (apiPushTimer) clearTimeout(apiPushTimer)
  apiPushTimer = setTimeout(() => {
    apiPushTimer = null
    void pushCatalogToApi()
  }, 600)
}

/** Load shared catalog from Vercel Blob / backend API (source of truth). */
export async function hydrateCatalogFromApi(): Promise<void> {
  const result = await fetchCatalogFromApiDetailed()
  if (!result.ok) {
    const cached = readCatalogLs()
    if (cached) {
      snapshot = cached
      emit()
      console.warn(`${LOG_PREFIX} API unavailable — using localStorage cache`, {
        revision: cached.revision,
        products: cached.products.length,
        error: result.error,
      })
    } else {
      snapshot = seedSnapshot()
      emit()
      console.warn(`${LOG_PREFIX} API unavailable — using built-in seed`, { error: result.error })
    }
    hasHydratedFromApi = true
    return
  }

  const remote = normalizeSnapshot(result.catalog)

  if (!hasHydratedFromApi) {
    applyRemoteCatalog(remote)
    hasHydratedFromApi = true
    console.info(`${LOG_PREFIX} Hydrated from API (source of truth)`, {
      revision: remote.revision,
      products: remote.products.length,
    })
    return
  }

  const remoteRev = remote.revision ?? 0
  const localRev = snapshot.revision ?? 0
  if (remoteRev >= localRev) {
    applyRemoteCatalog(remote)
    console.info(`${LOG_PREFIX} Refreshed from API`, { revision: remoteRev })
  } else if (adminSessionOk() && localRev > remoteRev) {
    console.info(`${LOG_PREFIX} Local revision is newer — pushing to API`, { localRev, remoteRev })
    await pushCatalogToApi()
  }
}

/** Refresh when user returns to the tab (e.g. admin edited on another device). */
export async function refreshCatalogFromApi(): Promise<void> {
  await hydrateCatalogFromApi()
}

/** Force an immediate API save (admin panel). */
export async function flushCatalogToApi(): Promise<SaveCatalogResult> {
  if (apiPushTimer) {
    clearTimeout(apiPushTimer)
    apiPushTimer = null
  }
  if (!adminSessionOk()) {
    return { ok: false, error: 'NOT_AUTHENTICATED' }
  }
  return pushCatalogToApi()
}

export function catalogLastApiPushFailed(): boolean {
  return lastApiPushFailed
}

function persistCatalog() {
  persistCatalogLocal()
  scheduleCatalogApiPush()
}

if (typeof window !== 'undefined') {
  void hydrateCatalogFromApi()
  window.addEventListener('storage', (e) => {
    if (e.key !== CMS_STORAGE_KEYS.catalog || !e.newValue || !hasHydratedFromApi) return
    try {
      const parsed = JSON.parse(e.newValue) as CatalogSnapshot
      if (parsed && Array.isArray(parsed.products)) {
        snapshot = normalizeSnapshot(parsed)
        emit()
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} Ignored invalid storage event`, err)
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
    homepage: normalizeHomepageContent(next, buildDefaultHomepage()),
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
    await pushCatalogToApi()
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
