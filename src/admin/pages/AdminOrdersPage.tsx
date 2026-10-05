import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { AdminBadge, AdminEmptyState, AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { AdminOrderTimeline } from '@/admin/components/AdminOrderTimeline'
import { downloadOrderInvoice, getAdminOrders, readAdminOrderApiError } from '@/api/order'
import { formatInr, formatOrderDateTime } from '@/lib/format'
import { paymentMethodLabel, paymentStatusLabel, paymentStatusTone } from '@/lib/orderDisplay'
import type { OrderItem, OrderPagination, OrderSummary } from '@/types/orderManagement'

const PAGE_SIZE = 10
/** Thumbnails shown before the rest collapse into a "+N" chip, per the contract. */
const THUMBS_PREVIEWED = 2

type OrderType = 'all' | 'current' | 'history'

const TYPE_TABS: { key: OrderType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'current', label: 'Current' },
  { key: 'history', label: 'History' },
]

function ItemThumb({ item }: { item: OrderItem }) {
  if (!item.imageUrl) return null
  return <img className="admin-order-thumb" src={item.imageUrl} alt="" loading="lazy" title={item.productName} />
}

/**
 * Admin order management.
 *
 * Search, order-type filtering and paging are all SERVER-side, using the endpoint's own
 * `search_parameter`, `order_type`, `page` and `page_size`. Nothing is filtered locally,
 * so an admin is never looking at a partial set.
 *
 * `search_parameter` is an admin-only parameter and is only ever sent from this screen.
 * Every request here carries the admin credential explicitly (see `getAdminOrders`), so
 * a shopper's token can never reach it.
 *
 * Managing an order — status, notes, address — happens on the detail screen this list
 * links to, which is where the contract puts those surfaces.
 */
export function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [pagination, setPagination] = useState<OrderPagination | null>(null)
  const [emptyMessage, setEmptyMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /*
   * `?search=` seeds the box so the detail screen's "View Customer" link lands here with
   * that customer's orders already filtered. It is read once, as the initial value, so
   * typing afterwards is never fought by the URL.
   */
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('search')?.trim() ?? ''
  const [query, setQuery] = useState(initialSearch)
  /** Debounced value actually sent as `search_parameter`. */
  const [search, setSearch] = useState(initialSearch)
  const [orderType, setOrderType] = useState<OrderType>('all')
  const [page, setPage] = useState(1)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const result = await getAdminOrders({
        page,
        page_size: PAGE_SIZE,
        ...(orderType === 'all' ? {} : { order_type: orderType }),
        ...(search ? { search_parameter: search } : {}),
      })
      if (current !== requestId.current) return
      setOrders(result.orders)
      setPagination(result.pagination)
      setEmptyMessage(result.message)
    } catch (err) {
      if (current !== requestId.current) return
      // A failed request is an error state, never an empty order list.
      setOrders([])
      setPagination(null)
      setError(readAdminOrderApiError(err, 'Something went wrong while loading orders.'))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [orderType, page, search])

  useEffect(() => {
    void load()
  }, [load])

  // Debounce typing so each keystroke does not fire its own request. A new search resets
  // to page 1, otherwise page 3 of the old result set would be requested for a new query.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query.trim())
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  const switchType = (next: OrderType) => {
    if (next === orderType) return
    setOrderType(next)
    setPage(1)
  }

  const handleInvoice = async (order: OrderSummary) => {
    if (downloadingId) return
    setDownloadingId(order.id)
    try {
      await downloadOrderInvoice(order.id, order.orderNumber, { asAdmin: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download this invoice.')
    } finally {
      setDownloadingId(null)
    }
  }

  const totalRecords = pagination?.totalRecords ?? null

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
          placeholder="Search order number, customer or email"
        />
        <div role="group" aria-label="Order type" style={{ display: 'flex', gap: 8 }}>
          {TYPE_TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              className={orderType === entry.key ? 'admin-btn' : 'admin-btn admin-btn--ghost'}
              aria-pressed={orderType === entry.key}
              onClick={() => switchType(entry.key)}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </section>

      {loading ? (
        <AdminLoadingState />
      ) : error ? (
        <AdminErrorState title="Unable to load orders" message={error} onRetry={load} />
      ) : orders.length === 0 ? (
        <AdminEmptyState
          title="No orders found"
          // The envelope's `message` ("Data not found.") is written for end users, so it
          // is shown as-is when the backend sends one.
          message={
            emptyMessage ||
            (search ? 'No orders match your search.' : 'There are no orders to show for this filter.')
          }
        />
      ) : (
        <>
          <AdminTable
            headers={['Order', 'Customer', 'Items', 'Qty', 'Total', 'Payment', 'Progress', 'Date', 'Actions']}
            rows={orders}
            getRowKey={(order) => order.id || order.orderNumber}
            renderRow={(order) => (
              <>
                <td className="admin-table__primary">
                  <Link to={`/admin/orders/${order.id}`} className="admin-link-button">
                    {order.orderNumber}
                  </Link>
                </td>

                <td>
                  {order.customerName ? <div>{order.customerName}</div> : null}
                  {order.customerEmail ? <div className="admin-table__muted">{order.customerEmail}</div> : null}
                  {!order.customerName && !order.customerEmail ? <span className="admin-muted">—</span> : null}
                </td>

                <td>
                  {order.items.length === 0 ? (
                    <span className="admin-muted">—</span>
                  ) : (
                    <div className="admin-order-thumbs">
                      {order.items.slice(0, THUMBS_PREVIEWED).map((item) => (
                        <ItemThumb key={item.key} item={item} />
                      ))}
                      {order.items.length > THUMBS_PREVIEWED ? (
                        <span className="admin-order-thumbs__more">+{order.items.length - THUMBS_PREVIEWED}</span>
                      ) : null}
                    </div>
                  )}
                </td>

                {/* The backend's own `total_items` — not `items.length`, which would count
                    distinct lines rather than units. */}
                <td>{order.totalItems !== null ? order.totalItems : <span className="admin-muted">—</span>}</td>

                <td>{order.grandTotal !== null ? formatInr(order.grandTotal) : <span className="admin-muted">—</span>}</td>

                <td>
                  {paymentStatusLabel(order.paymentStatus) ? (
                    <span className={`admin-pay admin-pay--${paymentStatusTone(order.paymentStatus)}`}>
                      {paymentStatusLabel(order.paymentStatus)}
                    </span>
                  ) : null}
                  {paymentMethodLabel(order.paymentMethod) ? (
                    <div className="admin-table__muted">{paymentMethodLabel(order.paymentMethod)}</div>
                  ) : null}
                  {!order.paymentStatus && !order.paymentMethod ? <span className="admin-muted">—</span> : null}
                </td>

                <td>
                  <div className="admin-order-progress">
                    {order.statusLabel ? <AdminBadge label={order.statusLabel} tone="outline" /> : null}
                    <AdminOrderTimeline steps={order.timeline} compact />
                  </div>
                </td>

                <td className="admin-table__muted">{formatOrderDateTime(order.orderedAt) ?? '—'}</td>

                <td className="admin-table__actions">
                  <Link to={`/admin/orders/${order.id}`} className="admin-link-button">
                    View Details
                  </Link>
                  <button
                    type="button"
                    className="admin-link-button"
                    onClick={() => handleInvoice(order)}
                    disabled={downloadingId !== null}
                  >
                    {downloadingId === order.id ? 'Preparing…' : 'Invoice'}
                  </button>
                </td>
              </>
            )}
          />

          {/* Paging follows the envelope's own `pagination` block. `has_next` /
              `has_previous` are read strictly, so a response without them yields disabled
              controls rather than an invented page count. */}
          <div className="admin-pagination">
            <span>
              {totalRecords !== null ? `Showing ${orders.length} of ${totalRecords}` : `Showing ${orders.length}`}
            </span>
            <button
              type="button"
              disabled={!pagination?.hasPrevious}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Prev
            </button>
            <span>
              Page {pagination?.page ?? page}
              {pagination?.totalPages ? ` of ${pagination.totalPages}` : ''}
            </span>
            <button type="button" disabled={!pagination?.hasNext} onClick={() => setPage((current) => current + 1)}>
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
