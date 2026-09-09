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

/**
 * Renders the backend's own status text.
 *
 * No status vocabulary is assumed, mapped or substituted, and every value gets the same
 * badge — the backend stays the single source of truth. The only change is display
 * formatting: underscores become spaces so `OUT_FOR_DELIVERY` reads as sentence-cased
 * words. The underlying value is never modified.
 */
function StatusBadge({ status }: { status: string }) {
  if (!status) return null
  return (
    <span className="shrink-0 border border-black bg-black px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-white">
      {status.replace(/_/g, ' ')}
    </span>
  )
}

/** Fixed thumbnail box, so images of any dimension keep the rows a uniform height. */
const THUMB = 'h-24 w-20 shrink-0 overflow-hidden border border-zinc-200 bg-zinc-100'

function OrderItemRow({ item }: { item: CustomerOrderItem }) {
  const meta = [item.size ? `Size ${item.size}` : '', item.color, item.quantity !== null ? `Qty ${item.quantity}` : '']
    .filter(Boolean)
    .join(' · ')

  // Linked only when the response actually carried a product id — never guessed from the
  // order-line id, so a link can never open the wrong product.
  const to = item.productId ? `/product/${item.productId}` : null

  const thumb = item.imageUrl ? (
    <img
      src={item.imageUrl}
      alt=""
      // object-cover matches the product-image convention used by ProductCard and the cart.
      className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.04]"
      loading="lazy"
    />
  ) : (
    <span className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wide text-zinc-400">
      No image
    </span>
  )

  return (
    <li className="flex items-start gap-4 px-4 py-4 sm:px-5">
      {to ? (
        <Link to={to} className={THUMB} aria-label={item.name ? `View ${item.name}` : 'View product'}>
          {thumb}
        </Link>
      ) : (
        <span className={THUMB}>{thumb}</span>
      )}

      <div className="min-w-0 flex-1">
        {item.name ? (
          to ? (
            <Link
              to={to}
              className="font-sans text-sm font-semibold text-black underline-offset-2 hover:underline"
            >
              {item.name}
            </Link>
          ) : (
            <p className="font-sans text-sm font-semibold text-black">{item.name}</p>
          )
        ) : null}
        {meta ? <p className="mt-1.5 text-xs text-zinc-500">{meta}</p> : null}
      </div>

      {item.price !== null ? (
        <p className="shrink-0 text-right font-sans text-sm font-semibold text-black">
          {formatInr(item.price * (item.quantity ?? 1))}
        </p>
      ) : null}
    </li>
  )
}

/** Items shown before the card collapses the rest behind a toggle. */
const ITEMS_BEFORE_COLLAPSE = 3

function OrderCard({ order }: { order: CustomerOrder }) {
  const date = formatOrderDate(order.date)
  const [expanded, setExpanded] = useState(false)

  // One order is always one card; a long order collapses instead of splitting or growing
  // indefinitely tall.
  const isCollapsible = order.items.length > ITEMS_BEFORE_COLLAPSE
  const visibleItems = isCollapsible && !expanded ? order.items.slice(0, ITEMS_BEFORE_COLLAPSE) : order.items
  const hiddenCount = order.items.length - visibleItems.length

  return (
    <article className="border border-zinc-200 bg-white transition-colors hover:border-zinc-400">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-zinc-100 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Order</p>
          <p className="mt-1 truncate font-sans text-sm font-bold uppercase tracking-[0.1em] text-black">
            {order.reference}
          </p>
          {date ? <p className="mt-1 text-xs text-zinc-500">{date}</p> : null}
        </div>
        <StatusBadge status={order.status} />
      </header>

      {order.items.length > 0 ? (
        <ul className="divide-y divide-zinc-100">
          {visibleItems.map((item) => (
            <OrderItemRow key={item.key} item={item} />
          ))}
        </ul>
      ) : null}

      {isCollapsible ? (
        <div className="border-t border-zinc-100 px-4 sm:px-5">
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className="w-full py-3 text-left font-sans text-xs font-bold uppercase tracking-[0.12em] text-black underline-offset-2 hover:underline"
          >
            {expanded ? 'Show less' : `Show all ${order.items.length} items (+${hiddenCount})`}
          </button>
        </div>
      ) : null}

      {order.total !== null ? (
        <footer className="flex items-center justify-between border-t border-zinc-200 bg-[#fafafa] px-4 py-3.5 sm:px-5">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-zinc-600">Order Total</span>
          <span className="font-sans text-base font-bold text-black">{formatInr(order.total)}</span>
        </footer>
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
          <div className="mt-6 border border-zinc-200 bg-[#f7f7f5] px-6 py-10 text-center">
            <p className="font-sans text-sm font-bold uppercase tracking-[0.16em] text-black">No orders yet</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-600">
              Your recent orders will appear here once you place an order.
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-block border border-black bg-black px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-zinc-800"
            >
              Shop Now
            </Link>
          </div>
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
