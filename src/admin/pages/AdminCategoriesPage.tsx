import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { AdminConfirmModal } from '@/admin/components/AdminConfirmModal'
import {
  createCategory,
  deleteCategory,
  getCategoriesPage,
  readCategoryApiError,
  updateCategory,
} from '@/api/category'
import { useAdminProducts } from '@/admin/hooks/useAdminCatalog'
import type { CategoryDto, CategoryListResponse } from '@/types/api/CategoryDto'

const PAGE_SIZE = 10
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

type CategoryForm = {
  id: number | null
  name: string
  description: string
  is_active: boolean
  /** Only set when the admin picked a new file; otherwise the stored image is kept. */
  image: File | null
}

function emptyForm(): CategoryForm {
  return { id: null, name: '', description: '', is_active: true, image: null }
}

function toForm(category: CategoryDto): CategoryForm {
  return {
    id: category.id,
    name: category.name ?? '',
    description: category.description ?? '',
    is_active: category.is_active !== false,
    image: null,
  }
}

export function AdminCategoriesPage() {
  const { data: products } = useAdminProducts()

  const [categories, setCategories] = useState<CategoryDto[]>([])
  const [pagination, setPagination] = useState<CategoryListResponse['pagination'] | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  /** Debounced value actually sent as `search_parameter`. */
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [form, setForm] = useState<CategoryForm | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CategoryDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  /** Synchronous guards — state updates are not immediate, so a double click could double-send. */
  const savingRef = useRef(false)
  const deletingRef = useRef(false)
  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)

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

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      // Search and paging are server-side, using the endpoint's documented parameters.
      const result = await getCategoriesPage({
        page,
        page_size: PAGE_SIZE,
        ...(search ? { search_parameter: search } : {}),
      })
      if (current !== requestId.current) return
      setCategories(result.data)
      setPagination(result.pagination)
    } catch (err) {
      if (current !== requestId.current) return
      setCategories([])
      setPagination(undefined)
      setError(readCategoryApiError(err, 'Something went wrong while loading categories.'))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [page, search])

  useEffect(() => {
    void load()
  }, [load])

  // Debounce typing so each keystroke does not fire its own request.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  const totalPages = Math.max(1, pagination?.total_pages ?? 1)
  const shownCount = pagination?.total_records ?? categories.length

  const closeForm = () => {
    if (savingRef.current) return
    setForm(null)
    setFormError(null)
  }

  const handleSave = async () => {
    if (!form || savingRef.current) return

    const name = form.name.trim()
    if (!name) return setFormError('Category name is required.')
    if (form.image && !form.image.type.startsWith('image/')) return setFormError('Choose an image file.')
    if (form.image && form.image.size > MAX_IMAGE_BYTES) return setFormError('Image must be 5 MB or smaller.')

    savingRef.current = true
    setSaving(true)
    setFormError(null)

    try {
      // Only fields the backend contract defines are sent, as multipart/form-data.
      if (form.id === null) {
        await createCategory({
          name,
          description: form.description,
          is_active: form.is_active,
          image: form.image,
        })
      } else {
        await updateCategory({
          id: form.id,
          name,
          description: form.description,
          is_active: form.is_active,
          image: form.image,
        })
      }

      setForm(null)
      setActionError(null)
      setNotice(form.id === null ? 'Category created.' : 'Category updated.')
      // The backend is the source of truth — nothing is inserted into the list locally.
      await load()
    } catch (err) {
      setFormError(readCategoryApiError(err, 'Could not save this category.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete || deletingRef.current) return

    deletingRef.current = true
    setDeleting(true)
    setActionError(null)

    try {
      await deleteCategory(pendingDelete.id)
      setPendingDelete(null)
      setNotice('Category deleted.')
      await load()
    } catch (err) {
      setActionError(readCategoryApiError(err, 'Could not delete this category.'))
      setPendingDelete(null)
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  const field = (key: keyof CategoryForm, value: string | boolean | File | null) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

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
          onClick={() => {
            setForm(emptyForm())
            setFormError(null)
          }}
        >
          Add Category
        </button>
      </section>

      {notice ? <p className="admin-muted">{notice}</p> : null}
      {actionError ? (
        <p className="admin-form__error" role="alert">
          {actionError}
        </p>
      ) : null}

      {loading ? (
        <AdminLoadingState />
      ) : error ? (
        <AdminErrorState title="Unable to load categories" message={error} onRetry={load} />
      ) : categories.length === 0 ? (
        <AdminEmptyState
          title="No categories found"
          message={search ? 'No categories match your search.' : 'The categories API returned no records.'}
        />
      ) : (
        <>
          <AdminTable
            headers={['Image', 'Name', 'Description', 'Products', 'Status', 'Actions']}
            rows={categories}
            getRowKey={(category) => String(category.id)}
            renderRow={(category) => (
              <>
                <td>
                  {category.image_url ? (
                    <img
                      src={category.image_url}
                      alt=""
                      style={{ width: 40, height: 40, objectFit: 'cover', border: '1px solid var(--admin-border)' }}
                    />
                  ) : (
                    <span className="admin-muted">—</span>
                  )}
                </td>
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
                    onClick={() => {
                      setForm(toForm(category))
                      setFormError(null)
                    }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-link-button admin-link-button--danger"
                    onClick={() => {
                      setActionError(null)
                      setPendingDelete(category)
                    }}
                  >
                    Delete
                  </button>
                </td>
              </>
            )}
          />

          <div className="admin-pagination">
            <span>
              Showing {categories.length} of {shownCount}
            </span>
            <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              Prev
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={pagination ? !pagination.has_next : page >= totalPages}
              onClick={() => setPage((current) => current + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      {form ? (
        <div className="admin-modal__backdrop" onClick={closeForm}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={form.id === null ? 'Add category' : 'Edit category'}
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{form.id === null ? 'Add Category' : 'Edit Category'}</h3>

            <div className="admin-form">
              <div className="admin-form__field">
                <label htmlFor="category-name">Name</label>
                <input
                  id="category-name"
                  value={form.name}
                  onChange={(e) => field('name', e.target.value)}
                  placeholder="Hoodies"
                />
              </div>

              <div className="admin-form__field">
                <label htmlFor="category-description">Description</label>
                <input
                  id="category-description"
                  value={form.description}
                  onChange={(e) => field('description', e.target.value)}
                  placeholder="Optional"
                />
              </div>

              <div className="admin-form__field">
                <label htmlFor="category-image">Image</label>
                <input
                  id="category-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => field('image', e.target.files?.[0] ?? null)}
                />
                <span className="admin-muted" style={{ fontSize: '0.75rem' }}>
                  {form.image
                    ? form.image.name
                    : form.id === null
                      ? 'Optional. JPG or PNG, up to 5 MB.'
                      : 'Leave empty to keep the current image.'}
                </span>
              </div>

              <label className="admin-form__check">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => field('is_active', e.target.checked)}
                />
                Active
              </label>

              {formError ? (
                <p className="admin-form__error" role="alert">
                  {formError}
                </p>
              ) : null}
            </div>

            <div className="admin-modal__actions">
              <button type="button" className="admin-btn admin-btn--ghost" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="admin-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : form.id === null ? 'Create Category' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete category?"
        message={`This deletes ${pendingDelete?.name ?? 'this category'}. The backend performs a soft delete, so the record is kept and marked inactive.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setPendingDelete(null)
        }}
      />
    </div>
  )
}
