import { useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { AdminConfirmModal } from '@/admin/components/AdminConfirmModal'
import { useAdminProducts } from '@/admin/hooks/useAdminCatalog'
import { formatCurrency } from '@/admin/utils/formatters'
import type { ProductDto } from '@/types/api/ProductDto'

const PAGE_SIZE = 10

export function AdminProductsPage() {
  const { data: products, loading, error, reload } = useAdminProducts()
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [pendingDelete, setPendingDelete] = useState<ProductDto | null>(null)

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category?.name).filter(Boolean))].sort(),
    [products],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((product) => {
      const matchesQuery =
        !q ||
        product.name.toLowerCase().includes(q) ||
        (product.sku ?? '').toLowerCase().includes(q)
      const matchesCategory = categoryFilter === 'all' || product.category?.name === categoryFilter
      return matchesQuery && matchesCategory
    })
  }, [products, query, categoryFilter])

  // Reset to page 1 whenever the result set changes — previously the page index was kept,
  // so narrowing a search while on page 2+ rendered an empty table despite having matches.
  useEffect(() => {
    setPage(1)
  }, [query, categoryFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
  const hasFilters = Boolean(query.trim()) || categoryFilter !== 'all'

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Catalog</p>
          <h2>Products</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Products' }]} />
      </div>

      <section className="admin-toolbar">
        <label className="sr-only" htmlFor="admin-product-search">
          Search products
        </label>
        <input
          id="admin-product-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by product name or SKU"
        />
        <label className="sr-only" htmlFor="admin-product-category">
          Filter by category
        </label>
        <select
          id="admin-product-category"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="admin-btn"
          disabled
          title="Product creation requires an authenticated write endpoint on /v1/products_management/, which is not available to the frontend yet."
        >
          Add Product
        </button>
      </section>

      {loading ? (
        <AdminLoadingState />
      ) : error ? (
        <AdminErrorState title="Unable to load products" message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title="No products found"
          message={
            hasFilters
              ? 'No products match your current search or filter. Try clearing them.'
              : 'The catalog API returned no products.'
          }
        />
      ) : (
        <>
          <AdminTable
            headers={['Product', 'SKU', 'Category', 'Sub Category', 'Price', 'Status', 'Actions']}
            rows={visible}
            getRowKey={(product) => String(product.id)}
            renderRow={(product) => (
              <>
                <td className="admin-table__primary">{product.name}</td>
                <td className="admin-table__muted">{product.sku || '—'}</td>
                <td>{product.category?.name ?? '—'}</td>
                <td className="admin-table__muted">{product.sub_category?.name ?? '—'}</td>
                <td>{formatCurrency(product.selling_price)}</td>
                <td>
                  <AdminBadge
                    label={product.is_new_arrival ? 'New Arrival' : product.is_featured ? 'Featured' : 'Active'}
                    tone={product.is_new_arrival ? 'solid' : 'outline'}
                  />
                </td>
                <td className="admin-table__actions">
                  <button
                    type="button"
                    className="admin-link-button"
                    disabled
                    title="Editing requires an authenticated write endpoint on /v1/products_management/, which is not available to the frontend yet."
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-link-button admin-link-button--danger"
                    onClick={() => setPendingDelete(product)}
                  >
                    Delete
                  </button>
                </td>
              </>
            )}
          />

          <div className="admin-pagination">
            <span>
              Showing {visible.length} of {filtered.length}
              {filtered.length !== products.length ? ` (filtered from ${products.length})` : ''}
            </span>
            <button
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Prev
            </button>
            <span>
              Page {safePage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      <AdminConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete product?"
        message={
          pendingDelete
            ? `“${pendingDelete.name}” cannot be deleted yet: the catalog API does not expose an authenticated DELETE endpoint to this admin panel. No changes will be made.`
            : ''
        }
        confirmLabel="Close"
        onConfirm={() => setPendingDelete(null)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
