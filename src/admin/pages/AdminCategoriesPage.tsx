import { useEffect, useMemo, useState } from 'react'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { AdminConfirmModal } from '@/admin/components/AdminConfirmModal'
import { useAdminCategories, useAdminProducts } from '@/admin/hooks/useAdminCatalog'
import type { CategoryDto } from '@/types/api/CategoryDto'

const PAGE_SIZE = 10

export function AdminCategoriesPage() {
  const { data: categories, loading, error, reload } = useAdminCategories()
  const { data: products } = useAdminProducts()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [pendingDelete, setPendingDelete] = useState<CategoryDto | null>(null)

  /** Real product counts per category, derived from the live product list. */
  const productCounts = useMemo(() => {
    const counts = new Map<number, number>()
    for (const product of products) {
      const id = product.category?.id
      if (id == null) continue
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    return counts
  }, [products])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return categories
    return categories.filter((category) => category.name.toLowerCase().includes(q))
  }, [categories, query])

  useEffect(() => {
    setPage(1)
  }, [query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Catalog</p>
          <h2>Categories</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Categories' }]} />
      </div>

      <section className="admin-toolbar">
        <label className="sr-only" htmlFor="admin-category-search">
          Search categories
        </label>
        <input
          id="admin-category-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search categories"
        />
        <button
          type="button"
          className="admin-btn"
          disabled
          title="Category creation requires an authenticated write endpoint on /v1/categories_management/, which is not available to the frontend yet."
        >
          Add Category
        </button>
      </section>

      {loading ? (
        <AdminLoadingState />
      ) : error ? (
        <AdminErrorState title="Unable to load categories" message={error} onRetry={reload} />
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          title="No categories found"
          message={
            query.trim()
              ? 'No categories match your search.'
              : 'The categories API returned no records.'
          }
        />
      ) : (
        <>
          <AdminTable
            headers={['Name', 'Description', 'Products', 'Status', 'Actions']}
            rows={visible}
            getRowKey={(category) => String(category.id)}
            renderRow={(category) => (
              <>
                <td className="admin-table__primary">{category.name}</td>
                <td className="admin-table__muted">{category.description || '—'}</td>
                <td>{productCounts.get(category.id) ?? 0}</td>
                <td>
                  <AdminBadge
                    label={category.is_active === false ? 'Inactive' : 'Active'}
                    tone={category.is_active === false ? 'subtle' : 'outline'}
                  />
                </td>
                <td className="admin-table__actions">
                  <button
                    type="button"
                    className="admin-link-button"
                    disabled
                    title="Editing requires an authenticated write endpoint on /v1/categories_management/, which is not available to the frontend yet."
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-link-button admin-link-button--danger"
                    onClick={() => setPendingDelete(category)}
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
        title="Delete category?"
        message={
          pendingDelete
            ? `“${pendingDelete.name}” cannot be deleted yet: the categories API does not expose an authenticated DELETE endpoint to this admin panel. No changes will be made.`
            : ''
        }
        confirmLabel="Close"
        onConfirm={() => setPendingDelete(null)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
