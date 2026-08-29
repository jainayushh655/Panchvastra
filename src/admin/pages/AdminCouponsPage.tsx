import { useCallback, useEffect, useRef, useState } from 'react'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { AdminConfirmModal } from '@/admin/components/AdminConfirmModal'
import { createCoupon, deleteCoupon, getCoupons, readCouponApiError, updateCoupon } from '@/api/coupon'
import { DISCOUNT_TYPES, type CouponDto, type DiscountType } from '@/types/api/CouponDto'

/** Form state mirrors the backend contract one-to-one; decimals stay strings throughout. */
type CouponForm = {
  id: number | null
  code: string
  discount_type: DiscountType
  discount_value: string
  maximum_discount_amount: string
  minimum_order_amount: string
  start_date: string
  end_date: string
  max_usage: string
  max_usage_per_user: string
  description: string
  is_first_order_only: boolean
  is_active: boolean
}

function emptyForm(): CouponForm {
  return {
    id: null,
    code: '',
    discount_type: 'PERCENTAGE',
    discount_value: '',
    maximum_discount_amount: '',
    minimum_order_amount: '0.00',
    start_date: '',
    end_date: '',
    max_usage: '',
    max_usage_per_user: '1',
    description: '',
    is_first_order_only: false,
    is_active: true,
  }
}

/** ISO date-time → the value a `datetime-local` input expects. */
function toLocalInput(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** `datetime-local` value → the ISO 8601 date-time the backend contract specifies. */
function toIso(value: string): string {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}

function toForm(coupon: CouponDto): CouponForm {
  const base = emptyForm()
  const type = String(coupon.discount_type ?? '').toUpperCase()
  return {
    ...base,
    id: coupon.id == null ? null : Number(coupon.id),
    code: coupon.code ?? '',
    discount_type: (DISCOUNT_TYPES as readonly string[]).includes(type) ? (type as DiscountType) : 'PERCENTAGE',
    discount_value: coupon.discount_value == null ? '' : String(coupon.discount_value),
    maximum_discount_amount: coupon.maximum_discount_amount == null ? '' : String(coupon.maximum_discount_amount),
    minimum_order_amount: coupon.minimum_order_amount == null ? '0.00' : String(coupon.minimum_order_amount),
    start_date: toLocalInput(coupon.start_date),
    end_date: toLocalInput(coupon.end_date),
    max_usage: coupon.max_usage == null ? '' : String(coupon.max_usage),
    max_usage_per_user: coupon.max_usage_per_user == null ? '1' : String(coupon.max_usage_per_user),
    description: coupon.description ?? '',
    is_first_order_only: Boolean(coupon.is_first_order_only),
    is_active: coupon.is_active !== false,
  }
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDiscount(coupon: CouponDto): string {
  const value = coupon.discount_value == null ? '' : String(coupon.discount_value)
  if (!value) return '—'
  const type = String(coupon.discount_type ?? '').toUpperCase()
  const numeric = Number(value)
  const shown = Number.isFinite(numeric) ? String(numeric) : value
  if (type === 'PERCENTAGE') return `${shown}%`
  if (type === 'FLAT') return `₹${shown}`
  return shown
}

export function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<CouponDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [form, setForm] = useState<CouponForm | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CouponDto | null>(null)
  const [deleting, setDeleting] = useState(false)
  /** Synchronous guards — state updates are not immediate, so a double click could double-send. */
  const savingRef = useRef(false)
  const deletingRef = useRef(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setCoupons(await getCoupons())
    } catch (err) {
      setCoupons([])
      setError(readCouponApiError(err, 'Something went wrong while loading coupons.'))
    } finally {
      setLoading(false)
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

    const code = form.code.trim()
    if (!code) return setFormError('Coupon code is required.')
    if (!form.discount_value.trim()) return setFormError('Discount value is required.')
    const startIso = toIso(form.start_date)
    const endIso = toIso(form.end_date)
    if (!startIso) return setFormError('A valid start date is required.')
    if (!endIso) return setFormError('A valid end date is required.')
    if (new Date(endIso) <= new Date(startIso)) return setFormError('End date must be after the start date.')

    // Only fields the backend contract defines are sent.
    const payload = {
      code: code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: form.discount_value.trim(),
      minimum_order_amount: form.minimum_order_amount.trim() || '0.00',
      maximum_discount_amount: form.maximum_discount_amount.trim() || null,
      start_date: startIso,
      end_date: endIso,
      max_usage: form.max_usage.trim() ? Number(form.max_usage) : null,
      max_usage_per_user: form.max_usage_per_user.trim() ? Number(form.max_usage_per_user) : 1,
      description: form.description.trim() || null,
      is_first_order_only: form.is_first_order_only,
      is_active: form.is_active,
    }

    savingRef.current = true
    setSaving(true)
    setFormError(null)

    try {
      if (form.id === null) await createCoupon(payload)
      else await updateCoupon({ id: form.id, ...payload })

      setForm(null)
      setActionError(null)
      setNotice(form.id === null ? 'Coupon created.' : 'Coupon updated.')
      // The backend is the source of truth — nothing is inserted into the list locally.
      await load()
    } catch (err) {
      setFormError(readCouponApiError(err, 'Could not save this coupon.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete || deletingRef.current) return
    const id = pendingDelete.id
    if (id == null) {
      setActionError('This coupon has no id, so it cannot be deleted.')
      setPendingDelete(null)
      return
    }

    deletingRef.current = true
    setDeleting(true)
    setActionError(null)

    try {
      await deleteCoupon(id)
      setPendingDelete(null)
      setNotice('Coupon deactivated.')
      await load()
    } catch (err) {
      setActionError(readCouponApiError(err, 'Could not delete this coupon.'))
      setPendingDelete(null)
    } finally {
      deletingRef.current = false
      setDeleting(false)
    }
  }

  const field = (key: keyof CouponForm, value: string | boolean) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Marketing</p>
          <h2>Coupons</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Coupons' }]} />
      </div>

      <section className="admin-toolbar">
        <button type="button" className="admin-btn" onClick={() => { setForm(emptyForm()); setFormError(null) }}>
          Add Coupon
        </button>
      </section>

      {notice ? <p className="admin-muted">{notice}</p> : null}
      {actionError ? <p className="admin-form__error" role="alert">{actionError}</p> : null}

      {loading ? (
        <AdminLoadingState />
      ) : error ? (
        <AdminErrorState title="Unable to load coupons" message={error} onRetry={load} />
      ) : coupons.length === 0 ? (
        <AdminEmptyState title="No coupons yet" message="The coupon API returned no active coupons." />
      ) : (
        <AdminTable
          headers={['Code', 'Discount', 'Min Order', 'Valid', 'Usage', 'Status', 'Actions']}
          rows={coupons}
          getRowKey={(coupon, index) => String(coupon.id ?? coupon.code ?? index)}
          renderRow={(coupon) => (
            <>
              <td className="admin-table__primary">{coupon.code ?? '—'}</td>
              <td>{formatDiscount(coupon)}</td>
              <td>{coupon.minimum_order_amount == null ? '—' : `₹${Number(coupon.minimum_order_amount)}`}</td>
              <td className="admin-table__muted">
                {formatDate(coupon.start_date)} – {formatDate(coupon.end_date)}
              </td>
              <td className="admin-table__muted">{coupon.max_usage == null ? 'Unlimited' : coupon.max_usage}</td>
              <td>
                <AdminBadge
                  label={coupon.is_active === false ? 'Inactive' : 'Active'}
                  tone={coupon.is_active === false ? 'subtle' : 'outline'}
                />
              </td>
              <td className="admin-table__actions">
                <button
                  type="button"
                  className="admin-link-button"
                  onClick={() => { setForm(toForm(coupon)); setFormError(null) }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="admin-link-button admin-link-button--danger"
                  onClick={() => { setActionError(null); setPendingDelete(coupon) }}
                >
                  Delete
                </button>
              </td>
            </>
          )}
        />
      )}

      {form ? (
        <div className="admin-modal__backdrop" onClick={closeForm}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={form.id === null ? 'Add coupon' : 'Edit coupon'}
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{form.id === null ? 'Add Coupon' : 'Edit Coupon'}</h3>

            <div className="admin-form">
              <div className="admin-form__row">
                <div className="admin-form__field">
                  <label htmlFor="coupon-code-input">Code</label>
                  <input
                    id="coupon-code-input"
                    value={form.code}
                    onChange={(e) => field('code', e.target.value)}
                    placeholder="SAVE10"
                  />
                </div>
                <div className="admin-form__field">
                  <label htmlFor="coupon-type">Discount Type</label>
                  <select
                    id="coupon-type"
                    value={form.discount_type}
                    onChange={(e) => field('discount_type', e.target.value)}
                  >
                    {DISCOUNT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="admin-form__row">
                <div className="admin-form__field">
                  <label htmlFor="coupon-value">Discount Value</label>
                  <input
                    id="coupon-value"
                    value={form.discount_value}
                    onChange={(e) => field('discount_value', e.target.value)}
                    placeholder="10.00"
                  />
                </div>
                <div className="admin-form__field">
                  <label htmlFor="coupon-max-discount">Max Discount Amount</label>
                  <input
                    id="coupon-max-discount"
                    value={form.maximum_discount_amount}
                    onChange={(e) => field('maximum_discount_amount', e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="admin-form__row">
                <div className="admin-form__field">
                  <label htmlFor="coupon-min-order">Minimum Order Amount</label>
                  <input
                    id="coupon-min-order"
                    value={form.minimum_order_amount}
                    onChange={(e) => field('minimum_order_amount', e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="admin-form__field">
                  <label htmlFor="coupon-max-usage">Max Usage</label>
                  <input
                    id="coupon-max-usage"
                    type="number"
                    min="0"
                    value={form.max_usage}
                    onChange={(e) => field('max_usage', e.target.value)}
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <div className="admin-form__row">
                <div className="admin-form__field">
                  <label htmlFor="coupon-start">Start Date</label>
                  <input
                    id="coupon-start"
                    type="datetime-local"
                    value={form.start_date}
                    onChange={(e) => field('start_date', e.target.value)}
                  />
                </div>
                <div className="admin-form__field">
                  <label htmlFor="coupon-end">End Date</label>
                  <input
                    id="coupon-end"
                    type="datetime-local"
                    value={form.end_date}
                    onChange={(e) => field('end_date', e.target.value)}
                  />
                </div>
              </div>

              <div className="admin-form__row">
                <div className="admin-form__field">
                  <label htmlFor="coupon-per-user">Max Usage Per User</label>
                  <input
                    id="coupon-per-user"
                    type="number"
                    min="1"
                    value={form.max_usage_per_user}
                    onChange={(e) => field('max_usage_per_user', e.target.value)}
                  />
                </div>
                <div className="admin-form__field">
                  <label htmlFor="coupon-description">Description</label>
                  <input
                    id="coupon-description"
                    value={form.description}
                    onChange={(e) => field('description', e.target.value)}
                    placeholder="10% off"
                  />
                </div>
              </div>

              <label className="admin-form__check">
                <input
                  type="checkbox"
                  checked={form.is_first_order_only}
                  onChange={(e) => field('is_first_order_only', e.target.checked)}
                />
                First order only
              </label>

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
                {saving ? 'Saving…' : form.id === null ? 'Create Coupon' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete coupon"
        message={`This deactivates ${pendingDelete?.code ?? 'this coupon'}. The backend performs a soft delete, so the record is kept and marked inactive.`}
        confirmLabel={deleting ? 'Deleting…' : 'Delete'}
        onConfirm={handleDelete}
        onCancel={() => { if (!deleting) setPendingDelete(null) }}
      />
    </div>
  )
}
