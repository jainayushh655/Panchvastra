import { Link } from 'react-router-dom'
import { CMS_STORAGE_KEYS } from '@/cms/registry'
import { useCatalog } from '@/hooks/useCatalog'
import { useMemo } from 'react'
import { defaultHomepage, getOrderLog, resetCatalogToSeed } from '@/lib/catalogStore'

export function AdminDashboard() {
  const { products, categories, homepage, revision } = useCatalog()
  const orders = useMemo(() => getOrderLog(), [revision])

  const nuke = () => {
    if (!confirm('Reset catalog + homepage + orders to seed? Cannot undo.')) return
    void resetCatalogToSeed()
  }

  return (
    <div className="max-w-3xl">
      <h1 className="type-page-title text-white">Dashboard</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Catalog revision <strong className="text-orange-400">#{revision}</strong> · synced via{' '}
        <code className="text-xs text-orange-300">/api/catalog</code> · orders local key{' '}
        <code className="text-xs text-orange-300">{CMS_STORAGE_KEYS.orderLog}</code>
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-3xl font-bold text-orange-400">{products.length}</p>
          <p className="type-label">Products</p>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
          <p className="text-3xl font-bold text-orange-400">{categories.length}</p>
          <p className="type-label">Categories</p>
        </div>
        <Link
          to="/admin/orders"
          className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 transition-colors hover:border-orange-500/40"
        >
          <p className="text-3xl font-bold text-orange-400">{orders.length}</p>
          <p className="type-label">Orders (this browser)</p>
        </Link>
      </div>
      <div className="mt-12 space-y-2 text-sm text-zinc-400">
        <p>
          Homepage carousel:{' '}
          <span className="text-white">
            {homepage.heroSlides[0]?.title?.slice(0, 48) ?? homepage.heroTitle.slice(0, 48)}…
          </span>
          <span className="text-zinc-500"> (3 slides)</span>
        </p>
      </div>
      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          to="/admin/products/new"
          className="rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-zinc-950"
        >
          New product
        </Link>
        <Link to="/admin/homepage" className="rounded-full border border-zinc-600 px-5 py-2 text-sm font-semibold">
          Edit homepage
        </Link>
        <button
          type="button"
          className="rounded-full border border-red-900/70 px-5 py-2 text-sm font-semibold text-red-400"
          onClick={nuke}
        >
          Reset to seed
        </button>
        <button
          type="button"
          className="rounded-full border border-zinc-600 px-5 py-2 text-sm font-semibold"
          onClick={() => navigator.clipboard.writeText(JSON.stringify(defaultHomepage(), null, 2))}
        >
          Copy default homepage JSON
        </button>
      </div>
    </div>
  )
}
