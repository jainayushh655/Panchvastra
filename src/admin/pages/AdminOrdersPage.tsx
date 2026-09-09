import { useCallback, useEffect, useRef, useState } from 'react'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { getAdminOrders, readAdminOrderApiError, updateOrderStatus } from '@/api/order'
import { formatInr } from '@/lib/format'
import { ORDER_STATUS_VALUES } from '@/types/api/OrderDto'
import type { CustomerOrder, CustomerOrderItem } from '@/types/customerOrder'

const PAGE_SIZE = 10
/** Line items previewed in the table cell before the rest collapse into "+N more". */
const ITEMS_PREVIEWED = 2

type OrderType = 'current' | 'history'

/** Display-only: `OUT_FOR_DELIVERY` reads as words. The stored value is never changed. */
function statusLabel(status: string): string {
  return status.replace(/_/g, ' ')
}

/** Formats the backend's date for display only — the stored value is never modified. */
function formatOrderDate(value: string): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** One line's meta string, built only from values the response actually carried. */
function itemMeta(item: CustomerOrderItem): string {
  return [item.size, item.color, item.quantity !== null ? `×${item.quantity}` : '']
    .filter(Boolean)
    .join(' · ')
}

function ItemThumb({ item }: { item: CustomerOrderItem }) {
  if (!item.imageUrl) return null
  return (
    <img
      src={item.imageUrl}
      alt=""
      loading="lazy"
      style={{ width: 34, height: 42, objectFit: 'cover', border: '1px solid var(--admin-border)', flexShrink: 0 }}
    />
  )
}

/**
 * Admin order management.
 *
 * Search, order-type filtering and paging are all SERVER-side, using the endpoint's own
 * `search_parameter`, `order_type`, `page` and `page_size`. Nothing is filtered locally, so
 * the admin is never looking at a partial set.
 *
 * Status changes go through PUT /v1/orders/ and the list is then re-fetched — no local
 * state is invented for the new status, and the backend stays the source of truth.
 */
export function AdminOrdersPage() {
  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [hasNextPage, setHasNextPage] = useState(false)
  const [totalCount, setTotalCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [query, setQuery] = useState('')
  /** Debounced value actually sent as `search_parameter`. */
  const [search, setSearch] = useState('')
  const [orderType, setOrderType] = useState<OrderType>('current')
  const [page, setPage] = useState(1)

  /** The order open in the manage panel, plus its editable fields. */
  const [active, setActive] = useState<CustomerOrder | null>(null)
  const [status, setStatus] = useState('')
  const [trackingId, setTrackingId] = useState('')
  const [courierName, setCourierName] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  /** Synchronous guard — state updates are not immediate, so a double click could double-send. */
  const savingRef = useRef(false)
  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const result = await getAdminOrders({
        order_type: orderType,
        page,
        page_size: PAGE_SIZE,
        ...(search ? { search_parameter: search } : {}),
      })
      if (current !== requestId.current) return
      setOrders(result.orders)
      setHasNextPage(result.pageInfo.hasNextPage)
      setTotalCount(result.pageInfo.totalCount)
    } catch (err) {
      if (current !== requestId.current) return
      // A failed request is an error state, never an empty order list.
      setOrders([])
      setHasNextPage(false)
      setTotalCount(null)
      setError(readAdminOrderApiError(err, 'Something went wrong while loading orders.'))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [orderType, page, search])

  useEffect(() => {
    void load()
  }, [load])

  // Debounce typing so each keystroke does not fire its own request. Any new search
  // resets to page 1.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  const openOrder = (order: CustomerOrder) => {
    setActive(order)
    // Prefilled from the order's own data; empty when the response carried none, never
    // filled with an invented value.
    setStatus(order.status)
    setTrackingId(order.trackingId)
    setCourierName(order.courierName)
    setFormError(null)
  }

  const closePanel = () => {
    if (savingRef.current) return
    setActive(null)
    setFormError(null)
  }

  const handleSave = async () => {
    if (!active || savingRef.current) return
    if (!status) return setFormError('Choose an order status.')

    savingRef.current = true
    setSaving(true)
    setFormError(null)

    try {
      // Only the contract's own fields. Tracking values are sent when the admin has
      // entered them or the order already carried them, so saving a status never wipes
      // shipment details the backend already holds.
      const trimmedTracking = trackingId.trim()
      const trimmedCourier = courierName.trim()

      await updateOrderStatus({
        id: active.id,
        order_status: status,
        ...(trimmedTracking ? { tracking_id: trimmedTracking } : {}),
        ...(trimmedCourier ? { courier_name: trimmedCourier } : {}),
      })

      setActive(null)
      setNotice('Order updated.')
      // The backend is the source of truth — the new state is re-read, never assumed.
      await load()
    } catch (err) {
      setFormError(readAdminOrderApiError(err, 'Could not update this order.'))
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  const switchType = (next: OrderType) => {
    if (next === orderType) return
    setOrderType(next)
    setPage(1)
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Operations</p>
          <h2>Orders</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Orders' }]} />
      </div>

      <section className="admin-toolbar">
        <label className="sr-only" htmlFor="admin-order-search">
          Search orders
        </label>
        <input
          id="admin-order-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search order, customer or email"
        />
        <div role="group" aria-label="Order type" style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            className={orderType === 'current' ? 'admin-btn' : 'admin-btn admin-btn--ghost'}
            aria-pressed={orderType === 'current'}
            onClick={() => switchType('current')}
          >
            Current
          </button>
          <button
            type="button"
            className={orderType === 'history' ? 'admin-btn' : 'admin-btn admin-btn--ghost'}
            aria-pressed={orderType === 'history'}
            onClick={() => switchType('history')}
          >
            History
          </button>
        </div>
      </section>

      {notice ? <p className="admin-muted">{notice}</p> : null}

      {loading ? (
        <AdminLoadingState />
      ) : error ? (
        <AdminErrorState title="Unable to load orders" message={error} onRetry={load} />
      ) : (
        <>
          {orders.length === 0 ? (
            <AdminEmptyState
              title="No orders found"
              message={
                search
                  ? 'No orders match your search.'
                  : page > 1
                    ? 'There are no orders on this page.'
                    : orderType === 'history'
                      ? 'No delivered or cancelled orders yet.'
                      : 'There are no orders in progress right now.'
              }
            />
          ) : (
          <AdminTable
            headers={['Order', 'Customer', 'Items', 'Total', 'Payment', 'Status', 'Date', 'Action']}
            rows={orders}
            getRowKey={(order) => order.id || order.reference}
            renderRow={(order) => (
              <>
                <td className="admin-table__primary">{order.reference}</td>
                <td>
                  {order.customerName ? <div>{order.customerName}</div> : null}
                  {order.customerEmail ? (
                    <div className="admin-table__muted">{order.customerEmail}</div>
                  ) : null}
                  {!order.customerName && !order.customerEmail ? (
                    <span className="admin-muted">—</span>
                  ) : null}
                </td>
                <td>
                  {order.items.length === 0 ? (
                    <span className="admin-muted">—</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 190 }}>
                      {order.items.slice(0, ITEMS_PREVIEWED).map((item) => (
                        <div key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ItemThumb item={item} />
                          <div style={{ minWidth: 0 }}>
                            {item.name ? <div>{item.name}</div> : null}
                            {itemMeta(item) ? (
                              <div className="admin-table__muted">{itemMeta(item)}</div>
                            ) : null}
                          </div>
                        </div>
                      ))}
                      {order.items.length > ITEMS_PREVIEWED ? (
                        <span className="admin-muted">+{order.items.length - ITEMS_PREVIEWED} more</span>
                      ) : null}
                    </div>
                  )}
                </td>
                <td>{order.total !== null ? formatInr(order.total) : <span className="admin-muted">—</span>}</td>
                <td>
                  {order.paymentMethod || order.paymentStatus ? (
                    <>
                      {order.paymentMethod ? <div>{order.paymentMethod}</div> : null}
                      {order.paymentStatus ? (
                        <div className="admin-table__muted">{order.paymentStatus}</div>
                      ) : null}
                    </>
                  ) : (
                    <span className="admin-muted">—</span>
                  )}
                </td>
                <td>
                  {order.status ? (
                    <AdminBadge label={statusLabel(order.status)} tone="outline" />
                  ) : (
                    <span className="admin-muted">—</span>
                  )}
                </td>
                <td className="admin-table__muted">{formatOrderDate(order.date) || '—'}</td>
                <td className="admin-table__actions">
                  <button type="button" className="admin-link-button" onClick={() => openOrder(order)}>
                    View / Manage
                  </button>
                </td>
              </>
            )}
          />
          )}

          {/*
            Paging follows whatever the response actually reports: `readPageInfo` sets
            `hasNextPage` only when the payload says so, and the total is shown only when
            the backend sends one. No pagination field name is assumed.

            Kept visible on an empty page beyond the first, so an admin who pages past the
            end can still go back instead of being stranded on a dead end.
          */}
          {orders.length > 0 || page > 1 ? (
            <div className="admin-pagination">
              <span>
                {totalCount !== null
                  ? `Showing ${orders.length} of ${totalCount}`
                  : `Showing ${orders.length}`}
              </span>
              <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                Prev
              </button>
              <span>Page {page}</span>
              <button type="button" disabled={!hasNextPage} onClick={() => setPage((current) => current + 1)}>
                Next
              </button>
            </div>
          ) : null}
        </>
      )}

      {active ? (
        <div className="admin-modal__backdrop" onClick={closePanel}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Manage order ${active.reference}`}
            className="admin-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Order {active.reference}</h3>

            <div className="admin-form">
              <div className="admin-muted" style={{ fontSize: '0.8rem' }}>
                {[formatOrderDate(active.date), active.customerName, active.customerEmail]
                  .filter(Boolean)
                  .join(' · ') || 'No customer details returned for this order.'}
              </div>

              {active.paymentMethod || active.paymentStatus ? (
                <div className="admin-muted" style={{ fontSize: '0.8rem' }}>
                  Payment: {[active.paymentMethod, active.paymentStatus].filter(Boolean).join(' · ')}
                </div>
              ) : null}

              {active.items.length > 0 ? (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
                  {active.items.map((item) => (
                    <li key={item.key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ItemThumb item={item} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        {item.name ? <div>{item.name}</div> : null}
                        {itemMeta(item) ? <div className="admin-table__muted">{itemMeta(item)}</div> : null}
                      </div>
                      {item.price !== null ? (
                        <div style={{ textAlign: 'right' }}>
                          <div>{formatInr(item.price * (item.quantity ?? 1))}</div>
                          {item.quantity !== null && item.quantity > 1 ? (
                            <div className="admin-table__muted">{formatInr(item.price)} each</div>
                          ) : null}
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}

              {active.total !== null ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                  <span>Order Total</span>
                  <span>{formatInr(active.total)}</span>
                </div>
              ) : null}

              <div className="admin-form__field">
                <label htmlFor="order-status">Order Status</label>
                <select id="order-status" value={status} onChange={(event) => setStatus(event.target.value)}>
                  {/* An unrecognised backend value stays selectable rather than being
                      silently rewritten to something the backend never sent. */}
                  {status && !ORDER_STATUS_VALUES.includes(status as (typeof ORDER_STATUS_VALUES)[number]) ? (
                    <option value={status}>{statusLabel(status)}</option>
                  ) : null}
                  {ORDER_STATUS_VALUES.map((value) => (
                    <option key={value} value={value}>
                      {statusLabel(value)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shown for SHIPPED, and whenever the order already carries shipment data
                  so existing values are never hidden. */}
              {status === 'SHIPPED' || active.trackingId || active.courierName ? (
                <>
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
                </>
              ) : null}

              {formError ? (
                <p className="admin-form__error" role="alert">
                  {formError}
                </p>
              ) : null}
            </div>

            <div className="admin-modal__actions">
              <button type="button" className="admin-btn admin-btn--ghost" onClick={closePanel} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="admin-btn" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
