import type { CatalogSnapshot } from '@/lib/catalogStore'
import { storefrontApiPath } from '@/lib/storefrontApi'

const LOG_PREFIX = '[panchvastra/catalog]'

export type FetchCatalogResult =
  | { ok: true; catalog: CatalogSnapshot }
  | { ok: false; error: string; status?: number }

export type SaveCatalogResult =
  | { ok: true; revision: number }
  | { ok: false; error: string; status?: number }

export async function fetchCatalogFromApi(): Promise<CatalogSnapshot | null> {
  const result = await fetchCatalogFromApiDetailed()
  return result.ok ? result.catalog : null
}

export async function fetchCatalogFromApiDetailed(): Promise<FetchCatalogResult> {
  const url = storefrontApiPath('/api/catalog')
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) {
      const error = `HTTP_${res.status}`
      console.error(`${LOG_PREFIX} GET ${url} failed`, { status: res.status, statusText: res.statusText })
      return { ok: false, error, status: res.status }
    }
    const catalog = (await res.json()) as CatalogSnapshot
    if (!catalog || !Array.isArray(catalog.products)) {
      console.error(`${LOG_PREFIX} GET ${url} returned invalid catalog payload`)
      return { ok: false, error: 'INVALID_PAYLOAD' }
    }
    console.info(`${LOG_PREFIX} GET ${url} ok`, {
      revision: catalog.revision ?? 0,
      products: catalog.products.length,
    })
    return { ok: true, catalog }
  } catch (err) {
    console.error(`${LOG_PREFIX} GET ${url} network error`, err)
    return { ok: false, error: 'NETWORK_ERROR' }
  }
}

export async function saveCatalogToApi(
  snapshot: CatalogSnapshot,
  adminToken: string,
): Promise<SaveCatalogResult> {
  if (!adminToken.trim()) {
    console.warn(`${LOG_PREFIX} PUT skipped — admin token missing`)
    return { ok: false, error: 'MISSING_ADMIN_TOKEN' }
  }

  const url = storefrontApiPath('/api/catalog')
  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(snapshot),
    })

    if (!res.ok) {
      let error = `HTTP_${res.status}`
      try {
        const body = (await res.json()) as { error?: string; message?: string; code?: string }
        error = body.message || body.error || error
      } catch {
        /* non-JSON error body */
      }
      console.error(`${LOG_PREFIX} PUT ${url} failed`, { status: res.status, error })
      return { ok: false, error, status: res.status }
    }

    let revision = snapshot.revision ?? 0
    try {
      const body = (await res.json()) as { revision?: number }
      if (typeof body.revision === 'number') revision = body.revision
    } catch {
      /* empty body is fine */
    }

    console.info(`${LOG_PREFIX} PUT ${url} ok`, { revision, products: snapshot.products.length })
    return { ok: true, revision }
  } catch (err) {
    console.error(`${LOG_PREFIX} PUT ${url} network error`, err)
    return { ok: false, error: 'NETWORK_ERROR' }
  }
}
