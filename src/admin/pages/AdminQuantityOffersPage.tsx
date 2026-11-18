import { useCallback, useEffect, useRef, useState } from 'react'
import { AdminConfirmModal } from '@/admin/components/AdminConfirmModal'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { AdminTable } from '@/admin/components/AdminTable'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import {
  MAX_TIER_PERCENTAGE,
  MIN_TIER_PERCENTAGE,
  MIN_TIER_QUANTITY,
  createQuantityTier,
  deleteQuantityTier,
  getQuantityTiers,
  readQuantityTierApiError,
  updateQuantityTier,
  validateQuantityTier,
  type QuantityTierDto,
} from '@/api/quantityTiers'

/**
 * Quantity offers — the "More you shop, more you save" ladder.
 *
 * ⚠️ READ THIS BEFORE CHANGING A TIER. A tier applies to the TOTAL number of items in a
 * customer's cart, across different products — not per product and not per line. "Buy 3,
 * get 15% off" means three items of anything. Everything the storefront shows (the chips
 * on the product page, the cart's offer line, the nudge) follows from what is configured
 * here, and the discount itself is computed by the backend at checkout.
 *
 * Tiers are listed ascending by threshold, which is the order a shopper climbs them.
 */

type TierForm = {
  id: number | null
  minQuantity: string
  discountPercentage: string
  isActive: boolean
}

function emptyForm(): TierForm {
  return { id: null, minQuantity: '', discountPercentage: '', isActive: true }
}

function formFromTier(tier: QuantityTierDto): TierForm {
  return {
    id: tier.id,
    minQuantity: String(tier.min_quantity),
    discountPercentage: String(tier.discount_percentage),
    isActive: tier.is_active !== false,
  }
}

export function AdminQuantityOffersPage() {
  const [tiers, setTiers] = useState<QuantityTierDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const [form, setForm] = useState<TierForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [pendingDelete, setPendingDelete] = useState<QuantityTierDto | null>(null)

  /** Synchronous guard — state updates are not immediate, so a double click could double-send. */
  const savingRef = useRef(false)
  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const result = await getQuantityTiers(true)
      if (current !== requestId.current) return
      setTiers(result)
    } catch (err) {
      if (current !== requestId.current) return
      // A failed request is an error state, never an empty ladder.
      setTiers([])
      setError(readQuantityTierApiError(err, 'Something went wrong while loading quantity offers.'))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleSave = async () => {
    if (!form || savingRef.current) return

    const minQuantity = Number(form.minQuantity)
    const discountPercentage = Number(form.discountPercentage)

    // Mirrors the backend's bounds so a rejected value is named here rather than coming
    // back as a generic 400.
    const invalid = validateQuantityTier(minQuantity, discountPercentage)
    if (invalid) {
      setFormError(invalid)
      return
    }

    savingRef.current = true
    setSaving(true)
    setFormError(null)

    const payload = {
      min_quantity: minQuantity,
      discount_percentage: discountPercentage,
      is_active: form.isActive,
    }

    try {
      if (form.id === null) await createQuantityTier(payload)
      else await updateQuantityTier({ id: form.id, ...payload })

      setForm(null)
      setNotice(form.id === null ? 'Quantity offer created.' : 'Quantity offer updated.')
      // Nothing is changed locally on the client's say-so — the list is re-read.
      await load()
    } catch (err) {
      setFormError(readQuantityTierApiError(err, 'Could not save this quantity offer.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!pendingDelete) return

    const target = pendingDelete
    setPendingDelete(null)
    setActionError(null)

    try {
      await deleteQuantityTier(target.id)
      setNotice('Quantity offer deleted.')
      await load()
    } catch (err) {
      setActionError(readQuantityTierApiError(err, 'Could not delete this quantity offer.'))
    }
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Marketing</p>
          <h2>Quantity Offers</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Quantity Offers' }]} />
      </div>

      {notice ? <p className="admin-muted">{notice}</p> : null}
      {actionError ? (
        <p className="admin-form__error" role="alert">
          {actionError}
        </p>
      ) : null}

      <div className="admin-toolbar">
        <p className="admin-muted">
          Applies to the total number of items in a cart, across products — not per product.
        </p>
        <button
          type="button"
          className="admin-btn"
          onClick={() => {
            setFormError(null)
            setForm(emptyForm())
          }}
          disabled={loading}
        >
          Add Offer
        </button>
      </div>

      {loading ? (
        <AdminLoadingState rows={4} />
      ) : error ? (
        <AdminErrorState title="Unable to load quantity offers" message={error} onRetry={load} />
      ) : tiers.length === 0 ? (
        <AdminEmptyState
          title="No quantity offers"
          message="Add a tier such as “buy 2, get 10% off” to encourage larger carts."
        />
      ) : (
        <AdminTable
          headers={['Buy at least', 'Discount', 'Shopper sees', 'Status', 'Actions']}
          rows={tiers}
          getRowKey={(row) => String(row.id)}
          renderRow={(row) => (
            <>
              <td className="admin-table__primary">
                {row.min_quantity} item{row.min_quantity === 1 ? '' : 's'}
              </td>
              <td>{row.discount_percentage}%</td>
              <td className="admin-table__muted">
                BUY {row.min_quantity} GET {row.discount_percentage}% OFF
              </td>
              <td>
                <AdminBadge label={row.is_active ? 'Active' : 'Inactive'} tone={row.is_active ? 'solid' : 'outline'} />
              </td>
              <td className="admin-table__actions">
                <button
                  type="button"
                  className="admin-link-button"
                  onClick={() => {
                    setFormError(null)
                    setForm(formFromTier(row))
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="admin-link-button admin-link-button--danger"
                  onClick={() => setPendingDelete(row)}
                >
                  Delete
                </button>
              </td>
            </>
          )}
        />
      )}

      {form ? (
        <div className="admin-modal__backdrop" onClick={() => !saving && setForm(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={form.id === null ? 'Add quantity offer' : 'Edit quantity offer'}
            className="admin-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{form.id === null ? 'Add Quantity Offer' : 'Edit Quantity Offer'}</h3>

            <div className="admin-form">
              <div className="admin-form__row">
                <div className="admin-form__field">
                  <label htmlFor="tier-quantity">Minimum items in cart</label>
                  <input
                    id="tier-quantity"
                    type="number"
                    min={MIN_TIER_QUANTITY}
                    step={1}
                    value={form.minQuantity}
                    onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
                  />
                </div>

                <div className="admin-form__field">
                  <label htmlFor="tier-discount">Discount %</label>
                  <input
                    id="tier-discount"
                    type="number"
                    min={MIN_TIER_PERCENTAGE}
                    max={MAX_TIER_PERCENTAGE}
                    step="0.01"
                    value={form.discountPercentage}
                    onChange={(e) => setForm({ ...form, discountPercentage: e.target.value })}
                  />
                </div>
              </div>

              <label className="admin-form__check">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                Active
              </label>

              <p className="admin-muted">
                Minimum {MIN_TIER_QUANTITY} items; discount between {MIN_TIER_PERCENTAGE} and{' '}
                {MAX_TIER_PERCENTAGE} percent. One offer per quantity.
              </p>

              {formError ? (
                <p className="admin-form__error" role="alert">
                  {formError}
                </p>
              ) : null}
            </div>

            <div className="admin-modal__actions">
              <button
                type="button"
                className="admin-btn admin-btn--ghost"
                onClick={() => setForm(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="button" className="admin-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : form.id === null ? 'Create Offer' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminConfirmModal
        isOpen={pendingDelete !== null}
        title="Delete quantity offer"
        message={`Delete the “buy ${pendingDelete?.min_quantity ?? ''}, get ${pendingDelete?.discount_percentage ?? ''}% off” tier? It will stop applying to new carts immediately.`}
        onConfirm={handleDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
