import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminBadge, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { AdminOrderTimeline } from '@/admin/components/AdminOrderTimeline'
import {
  addOrderNote,
  deleteOrderNote,
  downloadOrderInvoice,
  getAdminOrderDetail,
  readAdminOrderApiError,
  updateOrderAddress,
  updateOrderStatus,
} from '@/api/order'
import { formatInr, formatOrderDate, formatOrderDateTime } from '@/lib/format'
import {
  isAddressEditable,
  paymentMethodLabel,
  paymentStatusLabel,
  paymentStatusTone,
  statusOptionLabel,
} from '@/lib/orderDisplay'
import { EDITABLE_ADDRESS_FIELDS, ORDER_STATUS_VALUES } from '@/types/api/OrderDto'
import type { EditableAddressField, UpdateOrderAddressDto } from '@/types/api/OrderDto'
import type { OrderDetail } from '@/types/orderManagement'

/** Labels for the address form. The API field name is the source of truth for the key. */
const ADDRESS_FIELD_LABELS: Record<EditableAddressField, string> = {
  customer_name: 'Customer Name',
  customer_mobile: 'Mobile',
  address_line_1: 'Address Line 1',
  address_line_2: 'Address Line 2',
  landmark: 'Landmark',
  city: 'City',
  state: 'State',
  country: 'Country',
  pincode: 'Pincode',
}

/** Maps each editable API field onto the value currently held on the order. */
function addressFormValues(order: OrderDetail): Record<EditableAddressField, string> {
  const address = order.address
  return {
    customer_name: address?.customerName ?? '',
    customer_mobile: address?.customerMobile ?? '',
    address_line_1: address?.addressLine1 ?? '',
    address_line_2: address?.addressLine2 ?? '',
    landmark: address?.landmark ?? '',
    city: address?.city ?? '',
    state: address?.state ?? '',
    country: address?.country ?? '',
    pincode: address?.pincode ?? '',
  }
}

/** A labelled row that renders nothing at all when the value is absent. */
function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <div className="admin-kv">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

/**
 * Admin order detail.
 *
 * Every write here is admin-only and goes through the admin credential explicitly, which
 * throws before the request when there is no admin session. The screen renders four
 * admin-only surfaces the customer UI never shows: the internal Notes panel, Edit
 * Address, status updates, and `created_by` on the status history.
 *
 * Writes re-render from their own response rather than refetching: `PUT /v1/orders/` and
 * `PUT /v1/orders/address/` both return the full updated detail, and `POST .../notes/`
 * returns the created note. That also means an address edit's automatic "fields changed"
 * note appears without a second request.
 */
export function AdminOrderDetailPage() {
  const { orderId = '' } = useParams()

  const [order, setOrder] = useState<OrderDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)

  const load = useCallback(async () => {
    if (!orderId) {
      setError('No order was specified.')
      setLoading(false)
      return
    }

    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const result = await getAdminOrderDetail(orderId)
      if (current !== requestId.current) return
      if (!result) {
        setOrder(null)
        setError('That order could not be found.')
        return
      }
      setOrder(result)
    } catch (err) {
      if (current !== requestId.current) return
      setOrder(null)
      setError(readAdminOrderApiError(err, 'Something went wrong while loading this order.'))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [orderId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="admin-page__eyebrow">Operations</p>
            <h2>Order</h2>
          </div>
          <Breadcrumb
            items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Orders', to: '/admin/orders' }, { label: 'Detail' }]}
          />
        </div>
        <AdminLoadingState />
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="admin-page">
        <div className="admin-page__header">
          <div>
            <p className="admin-page__eyebrow">Operations</p>
            <h2>Order</h2>
          </div>
          <Breadcrumb
            items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Orders', to: '/admin/orders' }, { label: 'Detail' }]}
          />
        </div>
        <AdminErrorState title="Unable to load this order" message={error ?? 'That order could not be found.'} onRetry={load} />
      </div>
    )
  }

  return (
    <OrderDetailView
      order={order}
      notice={notice}
      onNotice={setNotice}
      onOrderChange={setOrder}
      onReload={load}
    />
  )
}

/* ------------------------------------------------------------------ view */

function OrderDetailView({
  order,
  notice,
  onNotice,
  onOrderChange,
  onReload,
}: {
  order: OrderDetail
  notice: string | null
  onNotice: (value: string | null) => void
  onOrderChange: (value: OrderDetail) => void
  onReload: () => void
}) {
  const [actionError, setActionError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  const handleInvoice = async () => {
    if (downloading) return
    setDownloading(true)
    setActionError(null)
    try {
      await downloadOrderInvoice(order.id, order.orderNumber, { asAdmin: true })
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to download this invoice.')
    } finally {
      setDownloading(false)
    }
  }

  const applyUpdate = (updated: OrderDetail | null, message: string) => {
    if (updated) {
      // The write's own response IS the new state — no refetch.
      onOrderChange(updated)
      onNotice(message)
      return
    }
    // The call succeeded but returned no detail object. Rather than leaving stale data on
    // screen, the order is re-read so what is displayed is what the backend actually holds.
    onNotice(message)
    onReload()
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Operations</p>
          <h2>{order.orderNumber}</h2>
        </div>
        <Breadcrumb
          items={[
            { label: 'Admin', to: '/admin/dashboard' },
            { label: 'Orders', to: '/admin/orders' },
            { label: order.orderNumber },
          ]}
        />
      </div>

      <section className="admin-order-head">
        <div className="admin-order-head__meta">
          {order.statusLabel ? <AdminBadge label={order.statusLabel} tone="solid" /> : null}
          {paymentStatusLabel(order.paymentStatus) ? (
            <span className={`admin-pay admin-pay--${paymentStatusTone(order.paymentStatus)}`}>
              {paymentStatusLabel(order.paymentStatus)}
            </span>
          ) : null}
          {formatOrderDateTime(order.orderedAt) ? (
            <span className="admin-muted">Placed {formatOrderDateTime(order.orderedAt)}</span>
          ) : null}
        </div>

        <div className="admin-order-head__actions">
          {/*
            "View Customer" — this admin has no per-customer screen, so the destination
            is the order list pre-filtered to that customer through the endpoint's own
            `search_parameter` (which matches on email). That is a real, working view of
            the customer rather than a link to a route that does not exist.
          */}
          {order.customerEmail ? (
            <Link className="admin-link-button" to={`/admin/orders?search=${encodeURIComponent(order.customerEmail)}`}>
              View Customer
            </Link>
          ) : null}
          <button type="button" className="admin-btn" onClick={handleInvoice} disabled={downloading}>
            {downloading ? 'Preparing…' : 'Download Invoice'}
          </button>
        </div>
      </section>

      {notice ? <p className="admin-muted">{notice}</p> : null}
      {actionError ? (
        <p className="admin-form__error" role="alert">
          {actionError}
        </p>
      ) : null}

      {order.timeline.length > 0 ? (
        <section className="admin-panel">
          <h3 className="admin-panel__title">Progress</h3>
          <AdminOrderTimeline steps={order.timeline} />
        </section>
      ) : null}

      <div className="admin-detail-grid">
        <div className="admin-detail-grid__main">
          <ItemsPanel order={order} />
          <AddressPanel order={order} onApply={applyUpdate} />
          <PaymentPanel order={order} />
        </div>

        <div className="admin-detail-grid__side">
          <StatusPanel order={order} onApply={applyUpdate} />
          <StatusHistoryPanel order={order} />
          <NotesPanel order={order} onOrderChange={onOrderChange} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ items + money */

function ItemsPanel({ order }: { order: OrderDetail }) {
  const summary = order.priceSummary

  return (
    <section className="admin-panel">
      <h3 className="admin-panel__title">Items</h3>

      {order.items.length === 0 ? (
        <p className="admin-muted">No items on this order.</p>
      ) : (
        <ul className="admin-order-items">
          {order.items.map((item) => (
            <li key={item.key}>
              {item.imageUrl ? (
                <img className="admin-order-thumb admin-order-thumb--lg" src={item.imageUrl} alt="" loading="lazy" />
              ) : (
                <span className="admin-order-thumb admin-order-thumb--lg" />
              )}

              <div className="admin-order-items__body">
                <strong>{item.productName || '—'}</strong>
                <p className="admin-table__muted">
                  {[item.size ? `Size ${item.size}` : null, item.color, item.quantity !== null ? `Qty ${item.quantity}` : null]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {item.sku ? <p className="admin-table__muted">SKU {item.sku}</p> : null}
              </div>

              <div className="admin-order-items__price">
                {item.totalAmount !== null ? <strong>{formatInr(item.totalAmount)}</strong> : null}
                {item.sellingPrice !== null && (item.quantity ?? 0) > 1 ? (
                  <p className="admin-table__muted">({formatInr(item.sellingPrice)} each)</p>
                ) : null}
                {/* MRP only when it is genuinely higher, so there is no "struck-through"
                    price identical to the one beside it. */}
                {item.mrp !== null && item.sellingPrice !== null && item.mrp > item.sellingPrice ? (
                  <p className="admin-table__muted admin-strike">{formatInr(item.mrp)}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      {summary ? (
        <dl className="admin-money">
          <Row label="Subtotal" value={summary.subtotal !== null ? formatInr(summary.subtotal) : null} />
          {/* `discount_amount` arrives POSITIVE; the minus sign is presentation only. */}
          {summary.discountAmount !== null && summary.discountAmount > 0 ? (
            <div className="admin-kv">
              <dt>Discount</dt>
              <dd>- {formatInr(summary.discountAmount)}</dd>
            </div>
          ) : null}
          <Row label="Shipping" value={summary.shippingAmount !== null ? formatInr(summary.shippingAmount) : null} />
          <Row label="Tax" value={summary.taxAmount !== null ? formatInr(summary.taxAmount) : null} />
          {summary.grandTotal !== null ? (
            <div className="admin-kv admin-kv--total">
              <dt>Grand Total</dt>
              <dd>{formatInr(summary.grandTotal)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------------ payment */

function PaymentPanel({ order }: { order: OrderDetail }) {
  return (
    <section className="admin-panel">
      <h3 className="admin-panel__title">Payment</h3>
      <dl className="admin-money">
        <Row label="Method" value={paymentMethodLabel(order.paymentMethod)} />
        <Row label="Status" value={paymentStatusLabel(order.paymentStatus)} />
        {/* Null for COD orders — these rows are hidden rather than printing "null". */}
        <Row label="Transaction ID" value={order.transactionId} />
        <Row label="Paid At" value={formatOrderDateTime(order.paidAt)} />
        <Row label="Courier" value={order.courierName} />
        <Row label="Tracking ID" value={order.trackingId} />
        <Row label="Expected Delivery" value={formatOrderDate(order.expectedDeliveryDate)} />
        <Row label="Delivered At" value={formatOrderDateTime(order.deliveredAt)} />
        <Row label="Cancelled At" value={formatOrderDateTime(order.cancelledAt)} />
      </dl>
    </section>
  )
}

/* ------------------------------------------------------------------ address */

function AddressPanel({
  order,
  onApply,
}: {
  order: OrderDetail
  onApply: (updated: OrderDetail | null, message: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState(() => addressFormValues(order))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const savingRef = useRef(false)

  const address = order.address
  // The endpoint returns 400 once an order is DELIVERED or CANCELLED, so the control is
  // disabled rather than offering an action that is guaranteed to fail.
  const editable = isAddressEditable(order.status)

  const openEditor = () => {
    setValues(addressFormValues(order))
    setFormError(null)
    setEditing(true)
  }

  const handleSave = async () => {
    if (savingRef.current) return

    // Only CHANGED fields are sent; the backend keeps everything omitted. An empty field
    // that was already empty is not a change, so it is not sent as "".
    const original = addressFormValues(order)
    const payload: UpdateOrderAddressDto = { id: order.id }
    let changed = false
    for (const field of EDITABLE_ADDRESS_FIELDS) {
      const next = values[field].trim()
      if (next !== original[field].trim()) {
        payload[field] = next
        changed = true
      }
    }

    if (!changed) {
      setFormError('Change at least one field before saving.')
      return
    }

    savingRef.current = true
    setSaving(true)
    setFormError(null)

    try {
      const updated = await updateOrderAddress(payload)
      setEditing(false)
      // The response carries the auto-written "fields changed" note too, so the Notes
      // panel updates from the same render.
      onApply(updated, 'Shipping address updated.')
    } catch (err) {
      setFormError(readAdminOrderApiError(err, 'Could not update this address.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <section className="admin-panel">
      <div className="admin-panel__head">
        <h3 className="admin-panel__title">Shipping Address</h3>
        <button
          type="button"
          className="admin-link-button"
          onClick={openEditor}
          disabled={!editable}
          title={editable ? undefined : 'The address can no longer be changed for a delivered or cancelled order.'}
        >
          Edit Address
        </button>
      </div>

      {address ? (
        <dl className="admin-money">
          <Row label="Name" value={address.customerName} />
          {/* Shown for reference but never editable — excluded from the form by contract. */}
          <Row label="Email" value={address.customerEmail} />
          <Row label="Mobile" value={address.customerMobile} />
          <Row label="Address" value={address.addressLine1} />
          {/* Nullable — the row disappears rather than showing an empty line. */}
          <Row label="Address 2" value={address.addressLine2} />
          <Row label="Landmark" value={address.landmark} />
          <Row label="City" value={address.city} />
          <Row label="State" value={address.state} />
          <Row label="Country" value={address.country} />
          <Row label="Pincode" value={address.pincode} />
        </dl>
      ) : (
        <p className="admin-muted">No shipping address on this order.</p>
      )}

      {editing ? (
        <div className="admin-modal__backdrop" onClick={() => (saving ? null : setEditing(false))}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Edit shipping address for ${order.orderNumber}`}
            className="admin-modal admin-modal--wide"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Edit Shipping Address</h3>
            <p className="admin-muted">
              The customer's email cannot be changed here. This updates only this order, not the customer's saved
              address book.
            </p>

            <div className="admin-form">
              <div className="admin-form__row">
                {EDITABLE_ADDRESS_FIELDS.map((field) => (
                  <div className="admin-form__field" key={field}>
                    <label htmlFor={`address-${field}`}>{ADDRESS_FIELD_LABELS[field]}</label>
                    <input
                      id={`address-${field}`}
                      value={values[field]}
                      onChange={(event) => setValues((current) => ({ ...current, [field]: event.target.value }))}
                    />
                  </div>
                ))}
              </div>

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
                onClick={() => setEditing(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="button" className="admin-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Address'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}

/* ------------------------------------------------------------------ status */

function StatusPanel({
  order,
  onApply,
}: {
  order: OrderDetail
  onApply: (updated: OrderDetail | null, message: string) => void
}) {
  const [status, setStatus] = useState(order.status)
  const [trackingId, setTrackingId] = useState(order.trackingId ?? '')
  const [courierName, setCourierName] = useState(order.courierName ?? '')
  const [expectedDate, setExpectedDate] = useState(order.expectedDeliveryDate ?? '')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  /** Synchronous guard — state is not immediate, so a double click could double-send. */
  const savingRef = useRef(false)

  // Re-sync whenever a write replaces the order, so the form shows the saved values
  // rather than what was typed before the last save.
  useEffect(() => {
    setStatus(order.status)
    setTrackingId(order.trackingId ?? '')
    setCourierName(order.courierName ?? '')
    setExpectedDate(order.expectedDeliveryDate ?? '')
    setNote('')
  }, [order])

  const handleSave = async () => {
    if (savingRef.current) return
    if (!status) {
      setFormError('Choose an order status.')
      return
    }

    savingRef.current = true
    setSaving(true)
    setFormError(null)

    try {
      const trimmedTracking = trackingId.trim()
      const trimmedCourier = courierName.trim()
      const trimmedNote = note.trim()

      const updated = await updateOrderStatus({
        id: order.id,
        order_status: status,
        // Only values the admin actually has are sent. Milestone timestamps are stamped
        // server-side on first arrival at a status and are never sent from here.
        ...(trimmedTracking ? { tracking_id: trimmedTracking } : {}),
        ...(trimmedCourier ? { courier_name: trimmedCourier } : {}),
        ...(expectedDate ? { expected_delivery_date: expectedDate } : {}),
        ...(trimmedNote ? { note: trimmedNote } : {}),
      })

      onApply(updated, 'Order updated.')
    } catch (err) {
      setFormError(readAdminOrderApiError(err, 'Could not update this order.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <section className="admin-panel">
      <h3 className="admin-panel__title">Update Status</h3>

      <div className="admin-form">
        <div className="admin-form__field">
          <label htmlFor="order-status">Order Status</label>
          <select id="order-status" value={status} onChange={(event) => setStatus(event.target.value)}>
            {/*
              A status the backend already holds but this contract does not list stays
              selectable, so opening the form can never silently rewrite an order to a
              status the backend never sent.
            */}
            {status && !ORDER_STATUS_VALUES.includes(status as (typeof ORDER_STATUS_VALUES)[number]) ? (
              <option value={status}>{statusOptionLabel(status)}</option>
            ) : null}
            {ORDER_STATUS_VALUES.map((value) => (
              <option key={value} value={value}>
                {statusOptionLabel(value)}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-form__field">
          <label htmlFor="order-expected">Expected Delivery Date</label>
          {/* The only way to set or revise "Expected by" — there is no separate endpoint. */}
          <input
            id="order-expected"
            type="date"
            value={expectedDate}
            onChange={(event) => setExpectedDate(event.target.value)}
          />
        </div>

        <div className="admin-form__row">
          <div className="admin-form__field">
            <label htmlFor="order-tracking">Tracking ID</label>
            <input
              id="order-tracking"
              value={trackingId}
              onChange={(event) => setTrackingId(event.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="admin-form__field">
            <label htmlFor="order-courier">Courier Name</label>
            <input
              id="order-courier"
              value={courierName}
              onChange={(event) => setCourierName(event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="admin-form__field">
          <label htmlFor="order-note">Transition Note</label>
          <textarea
            id="order-note"
            rows={2}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Optional — shown in the order timeline"
          />
        </div>

        {formError ? (
          <p className="admin-form__error" role="alert">
            {formError}
          </p>
        ) : null}

        <button type="button" className="admin-btn" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ status history */

function StatusHistoryPanel({ order }: { order: OrderDetail }) {
  return (
    <section className="admin-panel">
      <h3 className="admin-panel__title">Order Timeline</h3>

      {order.statusHistory.length === 0 ? (
        <p className="admin-muted">No status changes recorded yet.</p>
      ) : (
        // Rendered in the order received — the contract states this arrives reverse
        // chronological, so re-sorting here would only risk disagreeing with it.
        <ol className="admin-history">
          {order.statusHistory.map((entry) => (
            <li key={entry.id}>
              <strong>{entry.label}</strong>
              {entry.note ? <p>{entry.note}</p> : null}
              <span>
                {[formatOrderDateTime(entry.createdAt), entry.createdBy].filter(Boolean).join(' · ')}
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ notes */

function NotesPanel({
  order,
  onOrderChange,
}: {
  order: OrderDetail
  onOrderChange: (value: OrderDetail) => void
}) {
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const savingRef = useRef(false)

  const handleAdd = async () => {
    if (savingRef.current) return
    const note = draft.trim()
    // Blank/whitespace-only notes are a 400 — caught here so the admin gets an immediate
    // answer instead of a round trip.
    if (!note) {
      setFormError('Write a note before adding it.')
      return
    }

    savingRef.current = true
    setSaving(true)
    setFormError(null)

    try {
      const created = await addOrderNote({ order_id: order.id, note })
      if (created) {
        // Appended straight from the 201 response — no refetch.
        onOrderChange({ ...order, notes: [...order.notes, created] })
      }
      setDraft('')
    } catch (err) {
      setFormError(readAdminOrderApiError(err, 'Could not add this note.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const handleDelete = async (noteId: string) => {
    if (removingId) return
    setRemovingId(noteId)
    setFormError(null)

    try {
      await deleteOrderNote(noteId)
      onOrderChange({ ...order, notes: order.notes.filter((entry) => entry.id !== noteId) })
    } catch (err) {
      setFormError(readAdminOrderApiError(err, 'Could not delete this note.'))
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <section className="admin-panel">
      <h3 className="admin-panel__title">Internal Notes</h3>
      <p className="admin-muted">Visible to staff only. Customers never see these.</p>

      {order.notes.length === 0 ? (
        <p className="admin-muted">No notes yet.</p>
      ) : (
        <ul className="admin-history">
          {order.notes.map((entry) => (
            <li key={entry.id}>
              <div className="admin-panel__head">
                <strong>{entry.note}</strong>
                <button
                  type="button"
                  className="admin-link-button admin-link-button--danger"
                  onClick={() => handleDelete(entry.id)}
                  disabled={removingId !== null}
                >
                  {removingId === entry.id ? 'Removing…' : 'Delete'}
                </button>
              </div>
              <span>{[formatOrderDateTime(entry.createdAt), entry.createdBy].filter(Boolean).join(' · ')}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="admin-form">
        <div className="admin-form__field">
          <label htmlFor="order-new-note">Add Note</label>
          <textarea
            id="order-new-note"
            rows={2}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="e.g. Customer asked to deliver after 6pm"
          />
        </div>

        {formError ? (
          <p className="admin-form__error" role="alert">
            {formError}
          </p>
        ) : null}

        <button type="button" className="admin-btn" onClick={handleAdd} disabled={saving}>
          {saving ? 'Adding…' : 'Add Note'}
        </button>
      </div>
    </section>
  )
}
