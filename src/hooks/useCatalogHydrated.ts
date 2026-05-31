import { isCatalogHydrated, subscribeCatalog } from '@/lib/catalogStore'
import { useSyncExternalStore } from 'react'

/** True once the first GET /api/catalog has finished (storefront should wait before listing products). */
export function useCatalogHydrated(): boolean {
  return useSyncExternalStore(subscribeCatalog, isCatalogHydrated, () => true)
}
