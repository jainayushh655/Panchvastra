import type { CatalogSnapshot } from '@/lib/catalogStore'
import { storefrontApiPath } from '@/lib/storefrontApi'

export async function fetchCatalogFromApi(): Promise<CatalogSnapshot | null> {
  try {
    const res = await fetch(storefrontApiPath('/api/catalog'), { cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as CatalogSnapshot
  } catch {
    return null
  }
}

export async function saveCatalogToApi(snapshot: CatalogSnapshot, adminToken: string): Promise<boolean> {
  if (!adminToken.trim()) return false
  try {
    const res = await fetch(storefrontApiPath('/api/catalog'), {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(snapshot),
    })
    return res.ok
  } catch {
    return false
  }
}
