import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { getOrders, readOrderApiError } from '@/api/order'
import { formatInr } from '@/lib/format'
import { useAuth } from '@/context/AuthProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import type { CustomerOrder, CustomerOrderItem } from '@/types/customerOrder'

/** Formats the backend's date for display only — the stored value is never modified. */
function formatOrderDate(value: string): string {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

/** Renders the backend's own status text; no status vocabulary is assumed or substituted. */
function StatusBadge({ status }: { status: string }) {
  if (!status) return null
  return (
    <span className="border border-zinc-300 px-2 py-0.5 font-sans text-[10px] font-bold uppercase tracking-wider text-zinc-600">
      {status}
    </span>
  )
}

function OrderItemRow({ item }: { item: CustomerOrderItem }) {
  const meta = [item.size ? `Size ${item.size}` : '', item.color, item.quantity !== null ? `Qty ${item.quantity}` : '']
    .filter(Boolean)
    .join(' · ')

  return (
    <li className="flex gap-4 py-4 first:pt-0 last:pb-0">
      {item.imageUrl ? (
        <img src={item.imageUrl} alt="" className="h-20 w-16 shrink-0 border border-zinc-200 object-cover" />
      ) : null}
      <div className="min-w-0 flex-1">
        {item.name ? <p className="truncate font-sans text-sm font-semibold text-black">{item.name}</p> : null}
        {meta ? <p className="mt-1 text-xs text-zinc-500">{meta}</p> : null}
      </div>
      {item.price !== null ? (
        <p className="shrink-0 font-sans text-sm font-semibold text-black">
          {formatInr(item.price * (item.quantity ?? 1))}
        </p>
      ) : null}
    </li>
  )
}

function OrderCard({ order }: { order: CustomerOrder }) {
  const date = formatOrderDate(order.date)

  return (
    <article className="border border-zinc-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-sans text-xs font-bold uppercase tracking-[0.14em] text-black">Order {order.reference}</p>
          {date ? <p className="mt-1 text-xs text-zinc-500">{date}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={order.status} />
          {order.total !== null ? (
            <span className="font-sans text-sm font-bold text-black">{formatInr(order.total)}</span>
          ) : null}
        </div>
      </div>

      {order.items.length > 0 ? (
        <ul className="mt-4 divide-y divide-zinc-100 border-t border-zinc-100 pt-4">
          {order.items.map((item) => (
            <OrderItemRow key={item.key} item={item} />
          ))}
        </ul>
      ) : null}
    </article>
  )
}

export function OrdersPage() {
  useDocumentTitle('My Orders')
  const { token } = useAuth()

  const [orders, setOrders] = useState<CustomerOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const nextPage = useRef(2)
  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)
  /** Synchronous guard so a double click cannot fire two requests. */
  const inFlight = useRef(false)

  const load = useCallback(async () => {
    if (!token) {
      setOrders([])
      setError(null)
      setLoading(false)
      return
    }

    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const page = await getOrders()
      if (current !== requestId.current) return
      setOrders(page.orders)
      setHasNextPage(page.pageInfo.hasNextPage)
      nextPage.current = 2
    } catch (err) {
      if (current !== requestId.current) return
      // An API failure is an error state, never an empty order list.
      setOrders([])
      setHasNextPage(false)
      setError(readOrderApiError(err, 'Unable to load your orders.'))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [token])

  // Loads once on mount and whenever the signed-in session changes.
  useEffect(() => {
    void load()
  }, [load])

  /**
   * Appends the next page. Rendered only when the response itself reported a further page,
   * so this control never appears if the backend does not paginate.
   */
  const loadMore = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setLoadingMore(true)

    try {
      const page = await getOrders({ page: nextPage.current })
      setOrders((previous) => [...previous, ...page.orders])
      setHasNextPage(page.pageInfo.hasNextPage)
      nextPage.current += 1
    } catch (err) {
      setError(readOrderApiError(err, 'Unable to load more orders.'))
    } finally {
      inFlight.current = false
      setLoadingMore(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="border border-zinc-200 bg-white p-7 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.15)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Orders</p>
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight text-black">My Orders</h1>
        <p className="mt-2 text-sm text-zinc-600">Your recent orders will appear here once placed.</p>

        {loading ? (
          <div className="mt-6 border border-zinc-200 bg-[#f7f7f5] p-6 text-sm text-zinc-600" role="status" aria-live="polite">
            Loading your orders…
          </div>
        ) : error ? (
          <div className="mt-6 border border-zinc-200 bg-[#f7f7f5] p-6" role="alert">
            <p className="font-semibold text-black">Unable to load your orders.</p>
            <p className="mt-1.5 text-sm text-zinc-600">{error}</p>
            <Button className="mt-5" onClick={load}>
              Try Again
            </Button>
          </div>
        ) : orders.length === 0 ? (
          <>
            <div className="mt-6 border border-zinc-200 bg-[#f7f7f5] p-6 text-sm text-zinc-600">
              You haven’t placed any orders yet. Start shopping to see your order history here.
            </div>
            <div className="mt-6">
              <Link
                to="/shop"
                className="border border-black bg-black px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-zinc-800"
              >
                Browse Products
              </Link>
            </div>
          </>
        ) : (
          <>
            <div className="mt-6 space-y-4">
              {orders.map((order) => (
                <OrderCard key={order.id || order.reference} order={order} />
              ))}
            </div>

            {hasNextPage ? (
              <div className="mt-6 flex justify-center">
                <Button variant="outline" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load More'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
