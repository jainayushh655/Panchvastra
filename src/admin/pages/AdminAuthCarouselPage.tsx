import { useCallback, useEffect, useRef, useState } from 'react'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { AdminConfirmModal } from '@/admin/components/AdminConfirmModal'
import {
  createAuthCarouselImage,
  deleteAuthCarouselImage,
  getAuthCarouselImagesForAdmin,
  readAuthCarouselApiError,
  updateAuthCarouselImage,
} from '@/api/authCarousel'
import type { AuthCarouselDto } from '@/types/api/AuthCarouselDto'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

type CarouselForm = {
  id: number | null
  /** Kept as a string so the input can be cleared; parsed only on save. */
  display_order: string
  is_active: boolean
  /** Only set when the admin picked a new file; otherwise the stored image is kept. */
  image: File | null
}

function emptyForm(): CarouselForm {
  return { id: null, display_order: '', is_active: true, image: null }
}

function toForm(row: AuthCarouselDto): CarouselForm {
  return {
    id: row.id,
    display_order: typeof row.display_order === 'number' ? String(row.display_order) : '',
    is_active: row.is_active !== false,
    image: null,
  }
}

/**
 * Admin management for the Login/Signup/Home carousel.
 *
 * Reads use the admin token, so inactive images are listed here and can be re-activated —
 * the customer-facing pages never see them.
 *
 * Writes are multipart/form-data handled entirely in `@/api/authCarousel`; this page never
 * sets `Content-Type` itself. After every successful mutation the list is re-fetched from
 * the backend rather than patched locally, so the table always reflects real server state.
 */
export function AdminAuthCarouselPage() {
  const [rows, setRows] = useState<AuthCarouselDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [form, setForm] = useState<CarouselForm | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<AuthCarouselDto | null>(null)
  const [deleting, setDeleting] = useState(false)

  /** Synchronous guards — state updates are not immediate, so a double click could double-send. */
  const savingRef = useRef(false)
  const deletingRef = useRef(false)
  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)

  /** Object URL for the pending file, revoked on change so nothing leaks. */
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    const file = form?.image
    if (!file) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [form?.image])

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const data = await getAuthCarouselImagesForAdmin()
      if (current !== requestId.current) return
      setRows(data)
    } catch (err) {
      if (current !== requestId.current) return
      setRows([])
      setError(readAuthCarouselApiError(err, 'Something went wrong while loading the carousel.'))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const closeForm = () => {
    if (savingRef.current) return
    setForm(null)
    setFormError(null)
  }

  const handleSave = async () => {
    if (!form || savingRef.current) return

    const isCreate = form.id === null

    // The contract requires an image on create; on update it is optional.
    if (isCreate && !form.image) return setFormError('Choose an image to upload.')
    if (form.image && !form.image.type.startsWith('image/')) return setFormError('Choose an image file.')
    if (form.image && form.image.size > MAX_IMAGE_BYTES) return setFormError('Image must be 5 MB or smaller.')

    const orderText = form.display_order.trim()
    let displayOrder: number | undefined
    if (orderText) {
      const parsed = Number(orderText)
      if (!Number.isInteger(parsed) || parsed < 0) {
        return setFormError('Display order must be a whole number of 0 or more.')
      }
      displayOrder = parsed
    }

    savingRef.current = true
    setSaving(true)
    setFormError(null)

    try {
      if (isCreate) {
        // Omitting display_order lets the backend assign the current highest + 1.
        await createAuthCarouselImage({
          image: form.image as File,
          ...(displayOrder !== undefined ? { display_order: displayOrder } : {}),
          is_active: form.is_active,
        })
      } else {
        // `image` is sent only when a replacement was chosen, so changing just the order
        // or the status never needs a re-upload.
        await updateAuthCarouselImage({
          id: form.id as number,
          ...(displayOrder !== undefined ? { display_order: displayOrder } : {}),
          is_active: form.is_active,
          image: form.image,
        })
      }

      setForm(null)
      setActionError(null)
      setNotice(isCreate ? 'Carousel image added.' : 'Carousel image updated.')
      await load()
    } catch (err) {
      setFormError(readAuthCarouselApiError(err, 'Could not save this carousel image.'))
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
      await deleteAuthCarouselImage(pendingDelete.id)
      setPendingDelete(null)
      setNotice('Carousel image deleted.')
      await load()
    } catch (err) {
      setActionError(readAuthCarouselApiError(err, 'Could not delete this carousel image.'))
      setPendingDelete(null)
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  const field = (key: keyof CarouselForm, value: string | boolean | File | null) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

  const activeCount = rows.filter((row) => row.is_active !== false).length

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Content</p>
          <h2>Auth Carousel</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Auth Carousel' }]} />
      </div>

      <section className="admin-toolbar">
        <span className="admin-muted">
          Shown on the Home, Login and Signup pages, ordered by display order. Only active images
          are visible to customers.
        </span>
        <button
          type="button"
          className="admin-btn"
          onClick={() => {
            setForm(emptyForm())
            setFormError(null)
          }}
        >
          Add Image
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
        <AdminErrorState title="Unable to load the carousel" message={error} onRetry={load} />
      ) : rows.length === 0 ? (
        <AdminEmptyState
          title="No carousel images"
          message="Add an image to show it on the Home, Login and Signup pages."
        />
      ) : (
        <>
          <AdminTable
            headers={['Image', 'Display Order', 'Status', 'Actions']}
            rows={rows}
            getRowKey={(row) => String(row.id)}
            renderRow={(row) => (
              <>
                <td>
                  <img
                    src={row.image_url}
                    alt=""
                    style={{ width: 64, height: 40, objectFit: 'cover', border: '1px solid var(--admin-border)' }}
                  />
                </td>
                <td className="admin-table__primary">{row.display_order}</td>
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
                      setForm(toForm(row))
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
              {rows.length} image{rows.length === 1 ? '' : 's'} · {activeCount} active
            </span>
          </div>
        </>
      )}

      {form ? (
        <div className="admin-modal__backdrop" onClick={closeForm}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={form.id === null ? 'Add carousel image' : 'Edit carousel image'}
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{form.id === null ? 'Add Carousel Image' : 'Edit Carousel Image'}</h3>

            <div className="admin-form">
              <div className="admin-form__field">
                <label htmlFor="carousel-image">Image</label>
                <input
                  id="carousel-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => field('image', e.target.files?.[0] ?? null)}
                />
                <span className="admin-muted" style={{ fontSize: '0.75rem' }}>
                  {form.image
                    ? form.image.name
                    : form.id === null
                      ? 'Required. JPG, PNG or WebP, up to 5 MB.'
                      : 'Leave empty to keep the current image.'}
                </span>

                {/* Nothing is uploaded until Save — this is a local preview of the pending
                    file, or the image already stored for the row being edited. */}
                {preview ? (
                  <img
                    src={preview}
                    alt=""
                    style={{
                      marginTop: 8,
                      width: 160,
                      height: 100,
                      objectFit: 'cover',
                      border: '1px solid var(--admin-border)',
                    }}
                  />
                ) : form.id !== null ? (
                  (() => {
                    const current = rows.find((row) => row.id === form.id)
                    return current ? (
                      <img
                        src={current.image_url}
                        alt=""
                        style={{
                          marginTop: 8,
                          width: 160,
                          height: 100,
                          objectFit: 'cover',
                          border: '1px solid var(--admin-border)',
                        }}
                      />
                    ) : null
                  })()
                ) : null}
              </div>

              <div className="admin-form__field">
                <label htmlFor="carousel-order">Display Order</label>
                <input
                  id="carousel-order"
                  type="number"
                  min={0}
                  step={1}
                  value={form.display_order}
                  onChange={(e) => field('display_order', e.target.value)}
                  placeholder={form.id === null ? 'Optional — added last if empty' : ''}
                />
                <span className="admin-muted" style={{ fontSize: '0.75rem' }}>
                  Lower numbers appear first.
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
                {saving ? 'Saving…' : form.id === null ? 'Add Image' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete carousel image?"
        message="This removes the image from the Home, Login and Signup pages. The backend performs a soft delete, so the record is kept."
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deleting) setPendingDelete(null)
        }}
      />
    </div>
  )
}
