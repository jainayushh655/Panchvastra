import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { AdminConfirmModal } from '@/admin/components/AdminConfirmModal'
import { ProductImageUploader, toPendingImages, type PendingImage } from '@/admin/components/ProductImageUploader'
import {
  createProduct,
  deleteProduct,
  getProductById,
  getProductsPage,
  readProductApiError,
  updateProduct,
  type VariantImageFiles,
  type ProductPagination,
} from '@/api/product'
import { getCategories } from '@/api/category'
import { listSubCategories } from '@/api/subCategory'
import { formatCurrency } from '@/admin/utils/formatters'
import type { CategoryDto } from '@/types/api/CategoryDto'
import type { SubCategoryDto } from '@/types/api/SubCategoryDto'
import type { ProductDto } from '@/types/api/ProductDto'
import type { VariantImageDto } from '@/types/api/ProductDetailDto'
import type { ProductVariantWriteDto } from '@/types/api/ProductWriteDto'

const PAGE_SIZE = 10

type SizeForm = { id: number | null; size: string; stock_quantity: string; is_active: boolean }
type VariantForm = {
  id: number | null
  sku: string
  color: string
  mrp: string
  selling_price: string
  cost_price: string
  is_default: boolean
  is_active: boolean
  sizes: SizeForm[]
  /** Images already stored for this variant, straight from GET. Read-only. */
  existingImages: VariantImageDto[]
  /** Images picked in this session, not yet saved. */
  newImages: PendingImage[]
}
type ProductForm = {
  id: number | null
  category_id: string
  sub_category_id: string
  name: string
  description: string
  fabric: string
  gsm: string
  key_highlights: string
  is_featured: boolean
  is_new_arrival: boolean
  is_active: boolean
  variants: VariantForm[]
  /** Ids of children the admin removed, soft-deleted by the backend on save. */
  delete_variant_ids: number[]
  delete_size_ids: number[]
  /** Ids of saved variant images the admin removed. Sent only when non-empty. */
  delete_variant_image_ids: number[]
}

/**
 * `key_highlights` is stored by the API as a JSON string (healthy products read back as
 * `'["Yarn-dyed stripes", …]'`). The backend re-encodes whatever it receives, so handing the
 * stored string straight back added one escaping layer per save — which is how product 14
 * reached twelve nested layers.
 *
 * Unwrapping exactly ONE level for the editor, and re-parsing the edited text on save, makes
 * a save round-trip net-neutral: what goes out is the same shape that came in, so the value
 * can no longer grow. Exactly one level is unwrapped — the value is never peeled repeatedly
 * to make it "look clean", so already-corrupted data is reported rather than silently rewritten.
 */
function keyHighlightsToText(value: unknown): string {
  if (value == null) return ''
  if (typeof value !== 'string') return JSON.stringify(value, null, 2)

  try {
    const parsed: unknown = JSON.parse(value)
    // A JSON string unwraps to plain text; anything structured is shown as readable JSON.
    return typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2)
  } catch {
    // Not JSON (plain prose, or a value the backend never encoded) — show it verbatim.
    return value
  }
}

/**
 * Structured JSON is sent as a real value rather than a string; anything else is sent as the
 * plain text the admin typed. Nothing is rejected and no input is discarded.
 */
function keyHighlightsToPayload(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

const emptySize = (): SizeForm => ({ id: null, size: '', stock_quantity: '0', is_active: true })
const emptyVariant = (): VariantForm => ({
  id: null, sku: '', color: '', mrp: '', selling_price: '', cost_price: '',
  is_default: false, is_active: true, sizes: [emptySize()],
  existingImages: [], newImages: [],
})
const emptyForm = (): ProductForm => ({
  id: null, category_id: '', sub_category_id: '', name: '', description: '', fabric: '', gsm: '',
  key_highlights: '', is_featured: false, is_new_arrival: false, is_active: true,
  variants: [emptyVariant()], delete_variant_ids: [], delete_size_ids: [],
  delete_variant_image_ids: [],
})

export function AdminProductsPage() {
  const [products, setProducts] = useState<ProductDto[]>([])
  const [pagination, setPagination] = useState<ProductPagination | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [categories, setCategories] = useState<CategoryDto[]>([])
  /** Sub-categories for the category currently chosen in the form. */
  const [subCategories, setSubCategories] = useState<SubCategoryDto[]>([])
  const [subCategoriesLoading, setSubCategoriesLoading] = useState(false)

  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [page, setPage] = useState(1)

  const [form, setForm] = useState<ProductForm | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [formLoading, setFormLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<ProductDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  /** Synchronous guards — state updates are not immediate, so a double click could double-send. */
  const savingRef = useRef(false)
  const deletingRef = useRef(false)
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const result = await getProductsPage({
        page,
        page_size: PAGE_SIZE,
        ...(search ? { search } : {}),
        ...(categoryFilter !== 'all' ? { category_id: Number(categoryFilter) } : {}),
      })
      if (current !== requestId.current) return
      setProducts(result.data)
      setPagination(result.pagination)
    } catch (err) {
      if (current !== requestId.current) return
      setProducts([])
      setPagination(undefined)
      setError(readProductApiError(err, 'Something went wrong while loading products.'))
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
      .then((rows) => {
        if (!cancelled) setCategories(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setCategories([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Sub-categories always come from the dedicated endpoint, re-fetched whenever the form's
  // category changes (and when the form opens), so the list is never stale after a category
  // is edited or deleted. GET is public, so no admin token is involved.
  const formCategoryId = form?.category_id ?? ''
  useEffect(() => {
    if (!formCategoryId) {
      setSubCategories([])
      return
    }

    let cancelled = false
    setSubCategoriesLoading(true)
    listSubCategories({ category_id: Number(formCategoryId) })
      .then((rows) => {
        if (!cancelled) setSubCategories(Array.isArray(rows) ? rows : [])
      })
      .catch(() => {
        if (!cancelled) setSubCategories([])
      })
      .finally(() => {
        if (!cancelled) setSubCategoriesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [formCategoryId])

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

  const totalPages = Math.max(1, pagination?.total_pages ?? 1)
  const totalRecords = pagination?.total_records ?? products.length

  const categoryName = useMemo(() => {
    const map = new Map<number, string>()
    for (const c of categories) map.set(c.id, c.name)
    return map
  }, [categories])

  const openCreate = () => {
    setForm(emptyForm())
    setFormError(null)
  }

  /** Loads the full record (the list is variant-flattened and has no nested variants). */
  const openEdit = async (product: ProductDto) => {
    setFormError(null)
    setFormLoading(true)
    setForm({ ...emptyForm(), id: product.id, name: product.name })

    try {
      const detail = await getProductById(product.id)
      setForm({
        id: detail.id,
        category_id: detail.category?.id ? String(detail.category.id) : '',
        // The detail response carries the subcategory both nested and flat; read either so
        // an existing value survives an edit-and-save untouched.
        sub_category_id: (detail.sub_category?.id ?? detail.sub_category_id)
          ? String(detail.sub_category?.id ?? detail.sub_category_id)
          : '',
        name: detail.name ?? '',
        description: detail.description ?? '',
        fabric: detail.fabric ?? '',
        gsm: detail.gsm == null ? '' : String(detail.gsm),
        key_highlights: keyHighlightsToText(detail.key_highlights),
        is_featured: Boolean(detail.is_featured),
        is_new_arrival: Boolean(detail.is_new_arrival),
        // The detail response carries no product-level `is_active`, so this cannot be
        // prefilled from the backend — it defaults to active.
        is_active: true,
        variants: (detail.variants ?? []).map((v) => ({
          id: v.id,
          sku: v.sku ?? '',
          color: v.color ?? '',
          mrp: v.mrp == null ? '' : String(v.mrp),
          selling_price: v.selling_price == null ? '' : String(v.selling_price),
          cost_price: v.cost_price == null ? '' : String(v.cost_price),
          is_default: Boolean(v.is_default),
          is_active: true,
          sizes: (v.sizes ?? []).map((s) => ({
            id: s.id,
            size: s.size ?? '',
            stock_quantity: String(s.stock_quantity ?? 0),
            is_active: s.in_stock !== false,
          })),
          // Shown read-only: the write contract exposes no image field, deletion included.
          existingImages: v.images ?? [],
          newImages: [],
        })),
        delete_variant_ids: [],
        delete_size_ids: [],
        delete_variant_image_ids: [],
      })
    } catch (err) {
      setFormError(readProductApiError(err, 'Could not load this product.'))
    } finally {
      setFormLoading(false)
    }
  }

  const closeForm = () => {
    if (savingRef.current) return
    setForm(null)
    setFormError(null)
  }

  const patch = (changes: Partial<ProductForm>) => setForm((prev) => (prev ? { ...prev, ...changes } : prev))

  const patchVariant = (index: number, changes: Partial<VariantForm>) =>
    setForm((prev) =>
      prev ? { ...prev, variants: prev.variants.map((v, i) => (i === index ? { ...v, ...changes } : v)) } : prev,
    )

  const patchSize = (vIndex: number, sIndex: number, changes: Partial<SizeForm>) =>
    setForm((prev) =>
      prev
        ? {
            ...prev,
            variants: prev.variants.map((v, i) =>
              i === vIndex ? { ...v, sizes: v.sizes.map((s, j) => (j === sIndex ? { ...s, ...changes } : s)) } : v,
            ),
          }
        : prev,
    )

  const removeVariant = (index: number) =>
    setForm((prev) => {
      if (!prev) return prev
      const target = prev.variants[index]
      return {
        ...prev,
        variants: prev.variants.filter((_, i) => i !== index),
        // Existing children must be soft-deleted by the backend, not just dropped locally.
        delete_variant_ids: target?.id ? [...prev.delete_variant_ids, target.id] : prev.delete_variant_ids,
      }
    })

  const removeSize = (vIndex: number, sIndex: number) =>
    setForm((prev) => {
      if (!prev) return prev
      const target = prev.variants[vIndex]?.sizes[sIndex]
      return {
        ...prev,
        variants: prev.variants.map((v, i) =>
          i === vIndex ? { ...v, sizes: v.sizes.filter((_, j) => j !== sIndex) } : v,
        ),
        delete_size_ids: target?.id ? [...prev.delete_size_ids, target.id] : prev.delete_size_ids,
      }
    })

  /**
   * Appends picked files to this variant's pending list. Appending (never replacing) is what
   * lets the admin build a selection up across several trips to the file picker.
   */
  const addVariantImages = (index: number, files: FileList) => {
    const { accepted, rejected } = toPendingImages(files)

    if (rejected.length) {
      setFormError(
        rejected.length === 1
          ? `"${rejected[0]}" is not an image file and was skipped.`
          : `${rejected.length} files were skipped because they are not images.`,
      )
    } else if (accepted.length) {
      setFormError(null)
    }

    if (!accepted.length) return

    setForm((prev) =>
      prev
        ? {
            ...prev,
            variants: prev.variants.map((v, i) =>
              i === index ? { ...v, newImages: [...v.newImages, ...accepted] } : v,
            ),
          }
        : prev,
    )
  }

  /** Drops one pending image and frees its preview URL. Other selections are untouched. */
  const removeVariantImage = (index: number, key: string) => {
    setForm((prev) => {
      if (!prev) return prev
      const variant = prev.variants[index]
      const target = variant?.newImages.find((image) => image.key === key)
      if (target) URL.revokeObjectURL(target.previewUrl)

      return {
        ...prev,
        variants: prev.variants.map((v, i) =>
          i === index ? { ...v, newImages: v.newImages.filter((image) => image.key !== key) } : v,
        ),
      }
    })
  }

  /**
   * Removes a saved image from the form and records its id for deletion on save. No API call
   * happens here — nothing is destroyed until the admin saves.
   */
  const removeExistingImage = (index: number, imageId: number) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            variants: prev.variants.map((v, i) =>
              i === index
                ? { ...v, existingImages: v.existingImages.filter((image) => image.id !== imageId) }
                : v,
            ),
            delete_variant_image_ids: prev.delete_variant_image_ids.includes(imageId)
              ? prev.delete_variant_image_ids
              : [...prev.delete_variant_image_ids, imageId],
          }
        : prev,
    )
  }

  const handleSave = async () => {
    if (!form || savingRef.current) return

    const name = form.name.trim()
    if (!name) return setFormError('Product name is required.')
    if (!form.category_id) return setFormError('Category is required.')

    // Variants are optional overall, but any variant present must be complete.
    for (const [i, v] of form.variants.entries()) {
      const filled = v.sku.trim() || v.color.trim() || v.mrp.trim() || v.selling_price.trim()
      if (!filled) continue
      if (!v.sku.trim() || !v.color.trim() || !v.mrp.trim() || !v.selling_price.trim()) {
        return setFormError(`Variant ${i + 1} needs SKU, colour, MRP and selling price.`)
      }
      if (!v.sizes.some((s) => s.size.trim())) {
        return setFormError(`Variant ${i + 1} needs at least one size.`)
      }
    }

    // The variants actually sent, in order. Files are keyed by position in THIS list, so
    // the two must be derived from the same filtered source.
    const selectedVariants = form.variants.filter((v) => v.sku.trim() && v.color.trim())

    const variants: ProductVariantWriteDto[] = selectedVariants
      .map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        sku: v.sku.trim(),
        color: v.color.trim(),
        mrp: v.mrp.trim(),
        selling_price: v.selling_price.trim(),
        ...(v.cost_price.trim() ? { cost_price: v.cost_price.trim() } : {}),
        is_default: v.is_default,
        is_active: v.is_active,
        sizes: v.sizes
          .filter((s) => s.size.trim())
          .map((s) => ({
            ...(s.id ? { id: s.id } : {}),
            size: s.size.trim(),
            stock_quantity: Number(s.stock_quantity) || 0,
            is_active: s.is_active,
          })),
      }))

    const base = {
      category_id: Number(form.category_id),
      ...(form.sub_category_id ? { sub_category_id: Number(form.sub_category_id) } : {}),
      name,
      ...(form.description.trim() ? { description: form.description.trim() } : {}),
      ...(form.fabric.trim() ? { fabric: form.fabric.trim() } : {}),
      ...(form.gsm.trim() ? { gsm: Number(form.gsm) } : {}),
      ...(form.key_highlights.trim()
        ? { key_highlights: keyHighlightsToPayload(form.key_highlights.trim()) }
        : {}),
      is_featured: form.is_featured,
      is_new_arrival: form.is_new_arrival,
      is_active: form.is_active,
      ...(variants.length ? { variants } : {}),
    }

    // Files keyed by the variant's ZERO-BASED POSITION in `variants` — never by its id.
    // `selectedVariants` and `variants` are the same list, so indexes line up exactly.
    const images: VariantImageFiles = new Map()
    selectedVariants.forEach((variant, index) => {
      if (variant.newImages.length) images.set(index, variant.newImages.map((image) => image.file))
    })

    savingRef.current = true
    setSaving(true)
    setFormError(null)

    try {
      if (form.id === null) {
        // No images -> the existing JSON create is used unchanged.
        await createProduct(base, images)
      } else {
        await updateProduct(
          {
            id: form.id,
            ...base,
            // Always present, as arrays, exactly as the backend's update contract shows —
            // previously these were omitted when empty, which left the keys missing from
            // `data` entirely. `tags` is deliberately NOT sent: there is no tags editor, so
            // sending an empty array would clear a product's existing tags.
            delete_tag_ids: [],
            delete_variant_ids: form.delete_variant_ids,
            delete_size_ids: form.delete_size_ids,
            // Only present when the admin actually removed a saved image.
            ...(form.delete_variant_image_ids.length
              ? { delete_variant_image_ids: form.delete_variant_image_ids }
              : {}),
          },
          images,
        )
      }

      setForm(null)
      setActionError(null)
      setNotice(form.id === null ? 'Product created.' : 'Product updated.')
      // The backend is the source of truth — nothing is inserted into the list locally.
      await load()
    } catch (err) {
      setFormError(readProductApiError(err, 'Could not save this product.'))
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
      await deleteProduct(pendingDelete.id)
      setPendingDelete(null)
      setNotice('Product deleted.')
      await load()
    } catch (err) {
      setActionError(readProductApiError(err, 'Could not delete this product.'))
      setPendingDelete(null)
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  const hasFilters = Boolean(search) || categoryFilter !== 'all'

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
          {categories.map((category) => (
            <option key={category.id} value={String(category.id)}>
              {category.name}
            </option>
          ))}
        </select>
        <button type="button" className="admin-btn" onClick={openCreate}>
          Add Product
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
        <AdminErrorState title="Unable to load products" message={error} onRetry={load} />
      ) : products.length === 0 ? (
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
            rows={products}
            getRowKey={(product, index) => `${product.id}-${product.variant_id ?? index}`}
            renderRow={(product) => (
              <>
                <td className="admin-table__primary">{product.name}</td>
                <td className="admin-table__muted">{product.sku || '—'}</td>
                <td>{product.category?.name ?? categoryName.get(product.category?.id) ?? '—'}</td>
                <td className="admin-table__muted">{product.sub_category?.name ?? '—'}</td>
                <td>{formatCurrency(product.selling_price)}</td>
                <td>
                  <AdminBadge
                    label={product.is_new_arrival ? 'New Arrival' : product.is_featured ? 'Featured' : 'Active'}
                    tone={product.is_new_arrival ? 'solid' : 'outline'}
                  />
                </td>
                <td className="admin-table__actions">
                  <button type="button" className="admin-link-button" onClick={() => void openEdit(product)}>
                    Edit
                  </button>
                  <button
                    type="button"
                    className="admin-link-button admin-link-button--danger"
                    onClick={() => {
                      setActionError(null)
                      setPendingDelete(product)
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
              Showing {products.length} of {totalRecords}
            </span>
            <button type="button" disabled={page === 1} onClick={() => setPage((c) => Math.max(1, c - 1))}>
              Prev
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={pagination ? !pagination.has_next : page >= totalPages}
              onClick={() => setPage((c) => c + 1)}
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
            aria-label={form.id === null ? 'Add product' : 'Edit product'}
            className="admin-modal admin-modal--wide"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{form.id === null ? 'Add Product' : 'Edit Product'}</h3>

            {formLoading ? (
              <p className="admin-muted" style={{ marginTop: 16 }}>
                Loading product…
              </p>
            ) : (
              <div className="admin-form">
                <div className="admin-form__row">
                  <div className="admin-form__field">
                    <label htmlFor="product-name">Name</label>
                    <input
                      id="product-name"
                      value={form.name}
                      onChange={(e) => patch({ name: e.target.value })}
                      placeholder="Oversized Hoodie"
                    />
                  </div>
                  <div className="admin-form__field">
                    <label htmlFor="product-category">Category</label>
                    <select
                      id="product-category"
                      value={form.category_id}
                      // Changing category invalidates the current subcategory, so it is
                      // cleared immediately; the effect above loads the new category's list.
                      onChange={(e) => patch({ category_id: e.target.value, sub_category_id: '' })}
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
                    <label htmlFor="product-sub-category">Subcategory</label>
                    <select
                      id="product-sub-category"
                      value={form.sub_category_id}
                      disabled={!form.category_id || subCategoriesLoading}
                      onChange={(e) => patch({ sub_category_id: e.target.value })}
                    >
                      <option value="">
                        {!form.category_id
                          ? 'Select a category first'
                          : subCategoriesLoading
                            ? 'Loading…'
                            : 'No subcategory'}
                      </option>
                      {/* Inactive sub-categories are not offered for new assignments, but the
                          product's current one is always kept selectable so an existing
                          sub_category_id is never silently dropped on save. */}
                      {subCategories
                        .filter((sub) => sub.is_active !== false || String(sub.id) === form.sub_category_id)
                        .map((sub) => (
                          <option key={sub.id} value={String(sub.id)}>
                            {sub.name}
                            {sub.is_active === false ? ' (inactive)' : ''}
                          </option>
                        ))}
                      {/* The saved sub-category may not come back in the list at all (for
                          example once soft-deleted); keep it as an option so saving preserves it. */}
                      {form.sub_category_id &&
                      !subCategories.some((sub) => String(sub.id) === form.sub_category_id) ? (
                        <option value={form.sub_category_id}>Current selection (#{form.sub_category_id})</option>
                      ) : null}
                    </select>
                  </div>
                </div>

                <div className="admin-form__row">
                  <div className="admin-form__field">
                    <label htmlFor="product-fabric">Fabric</label>
                    <input
                      id="product-fabric"
                      value={form.fabric}
                      onChange={(e) => patch({ fabric: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="admin-form__field">
                    <label htmlFor="product-gsm">GSM</label>
                    <input
                      id="product-gsm"
                      type="number"
                      min="0"
                      value={form.gsm}
                      onChange={(e) => patch({ gsm: e.target.value })}
                      placeholder="Optional"
                    />
                  </div>
                </div>

                <div className="admin-form__field">
                  <label htmlFor="product-description">Description</label>
                  <input
                    id="product-description"
                    value={form.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    placeholder="Optional"
                  />
                </div>

                <div className="admin-form__field">
                  <label htmlFor="product-highlights">Key Highlights</label>
                  <input
                    id="product-highlights"
                    value={form.key_highlights}
                    onChange={(e) => patch({ key_highlights: e.target.value })}
                    placeholder="Optional"
                  />
                </div>

                <label className="admin-form__check">
                  <input
                    type="checkbox"
                    checked={form.is_featured}
                    onChange={(e) => patch({ is_featured: e.target.checked })}
                  />
                  Featured
                </label>
                <label className="admin-form__check">
                  <input
                    type="checkbox"
                    checked={form.is_new_arrival}
                    onChange={(e) => patch({ is_new_arrival: e.target.checked })}
                  />
                  New arrival
                </label>
                <label className="admin-form__check">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => patch({ is_active: e.target.checked })}
                  />
                  Active
                </label>

                {form.variants.map((variant, vIndex) => (
                  <div className="admin-variant" key={variant.id ?? `new-${vIndex}`}>
                    <div className="admin-variant__head">
                      <span className="admin-variant__title">Variant {vIndex + 1}</span>
                      {form.variants.length > 1 ? (
                        <button
                          type="button"
                          className="admin-link-button admin-link-button--danger"
                          onClick={() => removeVariant(vIndex)}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>

                    <div className="admin-form__row">
                      <div className="admin-form__field">
                        <label htmlFor={`variant-sku-${vIndex}`}>SKU</label>
                        <input
                          id={`variant-sku-${vIndex}`}
                          value={variant.sku}
                          onChange={(e) => patchVariant(vIndex, { sku: e.target.value })}
                        />
                      </div>
                      <div className="admin-form__field">
                        <label htmlFor={`variant-color-${vIndex}`}>Colour</label>
                        <input
                          id={`variant-color-${vIndex}`}
                          value={variant.color}
                          onChange={(e) => patchVariant(vIndex, { color: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="admin-form__row">
                      <div className="admin-form__field">
                        <label htmlFor={`variant-mrp-${vIndex}`}>MRP</label>
                        <input
                          id={`variant-mrp-${vIndex}`}
                          value={variant.mrp}
                          onChange={(e) => patchVariant(vIndex, { mrp: e.target.value })}
                          placeholder="1899.00"
                        />
                      </div>
                      <div className="admin-form__field">
                        <label htmlFor={`variant-price-${vIndex}`}>Selling Price</label>
                        <input
                          id={`variant-price-${vIndex}`}
                          value={variant.selling_price}
                          onChange={(e) => patchVariant(vIndex, { selling_price: e.target.value })}
                          placeholder="1399.00"
                        />
                      </div>
                    </div>

                    <div className="admin-form__field">
                      <label htmlFor={`variant-cost-${vIndex}`}>Cost Price</label>
                      <input
                        id={`variant-cost-${vIndex}`}
                        value={variant.cost_price}
                        onChange={(e) => patchVariant(vIndex, { cost_price: e.target.value })}
                        placeholder="Optional"
                      />
                    </div>

                    <label className="admin-form__check">
                      <input
                        type="checkbox"
                        checked={variant.is_default}
                        onChange={(e) => patchVariant(vIndex, { is_default: e.target.checked })}
                      />
                      Default variant
                    </label>

                    <div className="admin-variant__sizes">
                      <span className="admin-variant__title">Sizes</span>
                      {variant.sizes.map((size, sIndex) => (
                        <div className="admin-size-row" key={size.id ?? `new-${sIndex}`}>
                          <div className="admin-form__field">
                            <label htmlFor={`size-${vIndex}-${sIndex}`}>Size</label>
                            <input
                              id={`size-${vIndex}-${sIndex}`}
                              value={size.size}
                              onChange={(e) => patchSize(vIndex, sIndex, { size: e.target.value })}
                              placeholder="M"
                            />
                          </div>
                          <div className="admin-form__field">
                            <label htmlFor={`stock-${vIndex}-${sIndex}`}>Stock</label>
                            <input
                              id={`stock-${vIndex}-${sIndex}`}
                              type="number"
                              min="0"
                              value={size.stock_quantity}
                              onChange={(e) => patchSize(vIndex, sIndex, { stock_quantity: e.target.value })}
                            />
                          </div>
                          {variant.sizes.length > 1 ? (
                            <button
                              type="button"
                              className="admin-link-button admin-link-button--danger"
                              onClick={() => removeSize(vIndex, sIndex)}
                            >
                              Remove
                            </button>
                          ) : null}
                        </div>
                      ))}
                      <button
                        type="button"
                        className="admin-link-button"
                        onClick={() => patchVariant(vIndex, { sizes: [...variant.sizes, emptySize()] })}
                      >
                        + Add size
                      </button>
                    </div>

                    <ProductImageUploader
                      variantIndex={vIndex}
                      existingImages={variant.existingImages}
                      pendingImages={variant.newImages}
                      onAdd={(files) => addVariantImages(vIndex, files)}
                      onRemovePending={(key) => removeVariantImage(vIndex, key)}
                      onRemoveExisting={(imageId) => removeExistingImage(vIndex, imageId)}
                      disabled={saving}
                    />
                  </div>
                ))}

                <button
                  type="button"
                  className="admin-link-button"
                  onClick={() => patch({ variants: [...form.variants, emptyVariant()] })}
                >
                  + Add variant
                </button>

                {formError ? (
                  <p className="admin-form__error" role="alert">
                    {formError}
                  </p>
                ) : null}
              </div>
            )}

            <div className="admin-modal__actions">
              <button type="button" className="admin-btn admin-btn--ghost" onClick={closeForm} disabled={saving}>
                Cancel
              </button>
              <button
                type="button"
                className="admin-btn"
                onClick={handleSave}
                disabled={saving || formLoading}
              >
                {saving ? 'Saving…' : form.id === null ? 'Create Product' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete product?"
        message={`This deletes ${pendingDelete?.name ?? 'this product'}. The backend performs a soft delete, so the record is kept and marked inactive.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setPendingDelete(null)
        }}
      />
    </div>
  )
}
