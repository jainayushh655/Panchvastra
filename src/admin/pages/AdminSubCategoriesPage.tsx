import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { AdminConfirmModal } from '@/admin/components/AdminConfirmModal'
import {
  createSubCategory,
  deleteSubCategory,
  getSubCategoriesPage,
  readSubCategoryApiError,
  updateSubCategory,
} from '@/api/subCategory'
import { getCategories } from '@/api/category'
import type { CategoryDto } from '@/types/api/CategoryDto'
import type { SubCategoryDto, SubCategoryListResponse } from '@/types/api/SubCategoryDto'

const PAGE_SIZE = 10

type SubCategoryForm = {
  id: number | null
  category_id: string
  name: string
  is_active: boolean
}

const emptyForm = (): SubCategoryForm => ({ id: null, category_id: '', name: '', is_active: true })

const toForm = (row: SubCategoryDto): SubCategoryForm => ({
  id: row.id,
  category_id: row.category_id == null ? '' : String(row.category_id),
  name: row.name ?? '',
  is_active: row.is_active !== false,
})

export function AdminSubCategoriesPage() {
  const [rows, setRows] = useState<SubCategoryDto[]>([])
  const [pagination, setPagination] = useState<SubCategoryListResponse['pagination'] | undefined>(undefined)
  const [categories, setCategories] = useState<CategoryDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  /** Debounced value actually sent as `search_parameter`. */
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [page, setPage] = useState(1)

  const [form, setForm] = useState<SubCategoryForm | null>(null)
  /** The row as loaded, so an update can send only what actually changed. */
  const [original, setOriginal] = useState<SubCategoryForm | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SubCategoryDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  /** Synchronous guards — state updates are not immediate, so a double click could double-send. */
  const savingRef = useRef(false)
  const deletingRef = useRef(false)
  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      // Search, category filter and paging are all server-side.
      const result = await getSubCategoriesPage({
        page,
        page_size: PAGE_SIZE,
        ...(search ? { search_parameter: search } : {}),
        ...(categoryFilter !== 'all' ? { category_id: Number(categoryFilter) } : {}),
      })
      if (current !== requestId.current) return
      setRows(result.data)
      setPagination(result.pagination)
    } catch (err) {
      if (current !== requestId.current) return
      setRows([])
      setPagination(undefined)
      setError(readSubCategoryApiError(err, 'Something went wrong while loading sub-categories.'))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [page, search, categoryFilter])

  useEffect(() => {
    void load()
  }, [load])

  // Real categories power both the filter and the form's required category_id.
  useEffect(() => {
    let cancelled = false
    getCategories()
      .then((data) => {
        if (!cancelled) setCategories(Array.isArray(data) ? data : [])
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Debounce typing so each keystroke does not fire its own request.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    setPage(1)
  }, [categoryFilter])

  const categoryName = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of categories) map.set(c.id, c.name)
    return map
  }, [categories])

  const totalPages = Math.max(1, pagination?.total_pages ?? 1)
  const shownCount = pagination?.total_records ?? rows.length

  const closeForm = () => {
    if (savingRef.current) return
    setForm(null)
    setOriginal(null)
    setFormError(null)
  }

  const handleSave = async () => {
    if (!form || savingRef.current) return

    const name = form.name.trim()
    if (!form.category_id) return setFormError('Category is required.')
    if (!name) return setFormError('Sub-category name is required.')

    savingRef.current = true
    setSaving(true)
    setFormError(null)

    try {
      if (form.id === null) {
        await createSubCategory({
          category_id: Number(form.category_id),
          name,
          is_active: form.is_active,
        })
      } else {
        // Send `id` plus ONLY what changed, so an untouched field is never overwritten.
        const changes: { category_id?: number; name?: string; is_active?: boolean } = {}
        if (original && form.category_id !== original.category_id) changes.category_id = Number(form.category_id)
        if (original && name !== original.name.trim()) changes.name = name
        if (original && form.is_active !== original.is_active) changes.is_active = form.is_active

        if (Object.keys(changes).length === 0) {
          // The backend rejects an update carrying only an id, so this never leaves the client.
          setFormError('Nothing has changed yet.')
          return
        }

        await updateSubCategory({ id: form.id, ...changes })
      }

      setForm(null)
      setOriginal(null)
      setActionError(null)
      setNotice(form.id === null ? 'Sub-category created.' : 'Sub-category updated.')
      // The backend is the source of truth — nothing is inserted into the list locally.
      await load()
    } catch (err) {
      setFormError(readSubCategoryApiError(err, 'Could not save this sub-category.'))
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
      await deleteSubCategory(pendingDelete.id)
      setPendingDelete(null)
      setNotice('Sub-category deleted.')
      await load()
    } catch (err) {
      setActionError(readSubCategoryApiError(err, 'Could not delete this sub-category.'))
      setPendingDelete(null)
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  const field = (key: keyof SubCategoryForm, value: string | boolean) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Catalog</p>
          <h2>Sub-Categories</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Sub-Categories' }]} />
      </div>

      <section className="admin-toolbar">
        <label className="sr-only" htmlFor="admin-subcategory-search">
          Search sub-categories
        </label>
        <input
          id="admin-subcategory-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search sub-categories"
        />
        <label className="sr-only" htmlFor="admin-subcategory-category">
          Filter by category
        </label>
        <select
          id="admin-subcategory-category"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
        >
          <option value="all">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={String(category.id)}>
              {category.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="admin-btn"
          onClick={() => {
            setForm(emptyForm())
            setOriginal(null)
            setFormError(null)
          }}
        >
          Add Sub-Category
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
        <AdminErrorState title="Unable to load sub-categories" message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="No sub-categories found"
          message={
            search || categoryFilter !== 'all'
              ? 'No sub-categories match the current search or filter.'
              : 'The sub-categories API returned no records.'
          }
        />
      ) : (
        <>
          <AdminTable
            headers={['Sub-Category', 'Category', 'Status', 'Actions']}
            rows={rows}
            getRowKey={(row) => String(row.id)}
            renderRow={(row) => (
              <>
                <td className="admin-table__primary">{row.name}</td>
                <td className="admin-table__muted">{categoryName.get(row.category_id) ?? `#${row.category_id}`}</td>
                <td>
                  <AdminBadge
                    label={row.is_active === false ? 'Inactive' : 'Active'}
                    tone={row.is_active === false ? 'subtle' : 'outline'}
                  />
                </td>
                <td className="admin-table__actions">
                  <button
                    type="button"
                    className="admin-link-button"
                    onClick={() => {
                      const next = toForm(row)
                      setForm(next)
                      setOriginal(next)
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
                      setPendingDelete(row)
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
              Showing {rows.length} of {shownCount}
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
            aria-label={form.id === null ? 'Add sub-category' : 'Edit sub-category'}
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{form.id === null ? 'Add Sub-Category' : 'Edit Sub-Category'}</h3>

            <div className="admin-form">
              <div className="admin-form__field">
                <label htmlFor="subcategory-category">Category</label>
                <select
                  id="subcategory-category"
                  value={form.category_id}
                  onChange={(e) => field('category_id', e.target.value)}
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={String(category.id)}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-form__field">
                <label htmlFor="subcategory-name">Sub-Category Name</label>
                <input
                  id="subcategory-name"
                  value={form.name}
                  onChange={(e) => field('name', e.target.value)}
                  placeholder="Oversized"
                />
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
                {saving ? 'Saving…' : form.id === null ? 'Create Sub-Category' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete sub-category?"
        message={`This deletes ${pendingDelete?.name ?? 'this sub-category'}. The backend performs a soft delete, so the record is kept and marked inactive.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setPendingDelete(null)
        }}
      />
    </div>
  )
}
