import { getCatalogSnapshot, subscribeCatalog } from '@/lib/catalogStore'
import type { CatalogSnapshot } from '@/lib/catalogStore'
import { useSyncExternalStore } from 'react'

export function useCatalog(): CatalogSnapshot {
  return useSyncExternalStore(subscribeCatalog, getCatalogSnapshot, getCatalogSnapshot)
}
