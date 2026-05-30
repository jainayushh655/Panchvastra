import { useEffect, useState } from 'react'
import {
  CATALOG_SYNC_EVENT,
  catalogLastApiPushFailed,
  flushCatalogToApi,
  type CatalogSyncDetail,
} from '@/lib/catalogStore'

export function AdminCatalogSyncBanner() {
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  useEffect(() => {
    if (catalogLastApiPushFailed()) {
      setIsError(true)
      setMessage('Last catalog save to the server failed. Changes are local only until save succeeds.')
    }

    const onSync = (event: Event) => {
      const detail = (event as CustomEvent<CatalogSyncDetail>).detail
      if (detail.ok) {
        setIsError(false)
        setMessage(`Catalog saved to server (revision #${detail.revision}).`)
      } else {
        setIsError(true)
        setMessage(`Catalog save failed: ${detail.error}. Check console and Vercel Blob settings.`)
      }
    }

    window.addEventListener(CATALOG_SYNC_EVENT, onSync)
    return () => window.removeEventListener(CATALOG_SYNC_EVENT, onSync)
  }, [])

  if (!message) return null

  return (
    <div
      className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        isError
          ? 'border-red-900/60 bg-red-950/40 text-red-200'
          : 'border-emerald-900/60 bg-emerald-950/30 text-emerald-200'
      }`}
    >
      <p>{message}</p>
      {isError ? (
        <button
          type="button"
          className="rounded-full border border-current px-3 py-1 text-xs font-semibold"
          onClick={() => void flushCatalogToApi()}
        >
          Retry save
        </button>
      ) : null}
    </div>
  )
}
