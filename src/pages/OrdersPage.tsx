import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { OrderProgress } from '@/components/orders/OrderProgress'
import { EmptyOrders } from '@/components/orders/EmptyOrders'
import { downloadOrderInvoice, getCustomerOrderDetail, getOrders, readOrderApiError } from '@/api/order'
import { ReviewFormModal } from '@/components/reviews/ReviewFormModal'
import { formatInr, formatOrderDate, formatOrderDateTime } from '@/lib/format'
import { paymentMethodLabel, paymentStatusLabel, paymentStatusTone } from '@/lib/orderDisplay'
import { useToast } from '@/context/ToastProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import type { OrderDetail, OrderItem, OrderPagination, OrderSummary } from '@/types/orderManagement'

/**
 * The order status that unlocks reviewing.
 *
 * A customer can review only what they have actually received — the backend enforces it
 * and answers 403 otherwise, so showing the button on a shipped order would be an
 * invitation to a dead end.
 */
const DELIVERED_STATUS = 'DELIVERED'

/** What the review form needs to open, gathered from one order line. */
type ReviewTargetState = {
  mode: 'create' | 'edit'
  orderItemId: number
  reviewId: number | null
  productName: string
  size: string | null
  color: string | null
}

const PAGE_SIZE = 10

/** The three views of the list the endpoint's own `order_type` parameter supports. */
const TABS = [
  { key: 'all', label: 'All Orders' },
  { key: 'current', label: 'In Progress' },
  { key: 'history', label: 'Completed' },
] as const

type TabKey = (typeof TABS)[number]['key']

/* ------------------------------------------------------------------ bits */

function StatusBadge({ label }: { label: string }) {
  // Text is always the backend's `status_label`; nothing is derived from `order_status`.
  if (!label) return null
  return (
    <span className="shrink-0 border border-chocolate bg-chocolate px-2.5 py-1 font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-cream">
      {label}
    </span>
  )
}

const PAYMENT_TONES: Record<string, string> = {
  success: 'border-emerald-600 bg-emerald-50 text-emerald-700',
  pending: 'border-amber-500 bg-amber-50 text-amber-700',
  failed: 'border-red-600 bg-red-50 text-red-700',
  neutral: 'border-sand bg-soft-beige text-zinc-600',
}

function PaymentBadge({ status }: { status: string | null }) {
  const label = paymentStatusLabel(status)
  if (!label) return null
  return (
    <span
      className={`shrink-0 border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${PAYMENT_TONES[paymentStatusTone(status)]}`}
    >
      {label}
    </span>
  )
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m6 9 6 6 6-6" />
    </svg>
  )
}

function OrderItemRow({
  item,
  canReview,
  onReview,
}: {
  item: OrderItem
  /** True only for a DELIVERED order — the backend refuses a review on anything else. */
  canReview: boolean
  onReview: (target: ReviewTargetState) => void
}) {
  const meta = [item.size ? `Size ${item.size}` : null, item.color, item.quantity !== null ? `Qty ${item.quantity}` : null]
    .filter(Boolean)
    .join(' · ')

  /*
   * The review control, which is three states and not two:
   *   - not delivered, or no usable line id  -> nothing at all
   *   - delivered, reviewId null             -> "Write a review"
   *   - delivered, reviewId set              -> "Edit your review"
   * `orderItemId` is null when the response carried no line id, and a review cannot be
   * attached without one — so the button is withheld rather than opening a form that
   * would fail on submit.
   */
  const reviewAction =
    canReview && item.orderItemId !== null
      ? {
          label: item.reviewId !== null ? 'Edit your review' : 'Write a review',
          target: {
            mode: item.reviewId !== null ? ('edit' as const) : ('create' as const),
            orderItemId: item.orderItemId,
            reviewId: item.reviewId,
            productName: item.productName,
            size: item.size,
            color: item.color,
          },
        }
      : null

  // Linked only when the response carried a product id — never derived from the line id,
  // so a link can never open the wrong product.
  const to = item.productId ? `/product/${item.productId}` : null
  const thumbClass = 'h-24 w-20 shrink-0 overflow-hidden border border-zinc-200 bg-zinc-100'

  const thumb = item.imageUrl ? (
    <img src={item.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center text-[10px] uppercase tracking-wide text-zinc-400">
      No image
    </span>
  )

  return (
    <li className="flex items-start gap-4 px-4 py-4 sm:px-5">
      {to ? (
        <Link to={to} className={thumbClass} aria-label={item.productName ? `View ${item.productName}` : 'View product'}>
          {thumb}
        </Link>
      ) : (
        <span className={thumbClass}>{thumb}</span>
      )}

      <div className="min-w-0 flex-1">
        {item.productName ? (
          to ? (
            <Link to={to} className="font-sans text-sm font-semibold text-black underline-offset-2 hover:underline">
              {item.productName}
            </Link>
          ) : (
            <p className="font-sans text-sm font-semibold text-black">{item.productName}</p>
          )
        ) : null}
        {meta ? <p className="mt-1.5 text-xs text-zinc-500">{meta}</p> : null}

        {reviewAction ? (
          <button
            type="button"
            onClick={() => onReview(reviewAction.target)}
            className="mt-2 inline-flex min-h-[32px] items-center gap-1.5 font-sans text-xs font-semibold uppercase tracking-wide text-burgundy underline underline-offset-2"
          >
            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path
                d="M12 3.3l2.6 5.3 5.8.85-4.2 4.1 1 5.8-5.2-2.74L6.8 19.35l1-5.8-4.2-4.1 5.8-.85L12 3.3z"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            </svg>
            {reviewAction.label}
          </button>
        ) : null}
      </div>

      {/* The line total is the backend's `total_amount`; the per-unit price is only shown
          alongside it when the quantity makes it meaningful. */}
      {item.totalAmount !== null ? (
        <div className="shrink-0 text-right">
          <p className="font-sans text-sm font-semibold text-black">{formatInr(item.totalAmount)}</p>
          {item.sellingPrice !== null && (item.quantity ?? 0) > 1 ? (
            <p className="mt-0.5 text-xs text-zinc-500">({formatInr(item.sellingPrice)} each)</p>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}

/* ------------------------------------------------------------------ card */

function OrderCard({
  order,
  defaultOpen,
  onReview,
  detailToken,
}: {
  order: OrderSummary
  defaultOpen: boolean
  onReview: (target: ReviewTargetState) => void
  /** Bumped after a review is saved, so an open card re-reads and flips its button. */
  detailToken: number
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [downloading, setDownloading] = useState(false)
  const { showToast } = useToast()

  /**
   * The full order, loaded only when the card is opened.
   *
   * `price_summary` and `items[].review_id` are detail-only fields — the list response
   * carries neither — so they need the `?id=` read. Doing it lazily means a page of ten
   * orders costs one request, not eleven; most shoppers open at most one card.
   */
  const [detail, setDetail] = useState<OrderDetail | null>(null)
  const [detailError, setDetailError] = useState(false)

  useEffect(() => {
    if (!open) return

    let active = true
    setDetailError(false)

    getCustomerOrderDetail(order.id)
      .then((result) => {
        if (active) setDetail(result)
      })
      .catch(() => {
        // The card still renders from the list data; only the breakdown and the review
        // buttons are missing, so this degrades rather than failing the page.
        if (active) setDetailError(true)
      })

    return () => {
      active = false
    }
  }, [open, order.id, detailToken])

  // Prefer the detail's items (they carry `review_id`), falling back to the list's.
  const items = detail?.items?.length ? detail.items : order.items
  const priceSummary = detail?.priceSummary ?? null
  // `status` is the raw backend value and the only one safe to branch on; `statusLabel`
  // is display text and could be reworded at any time.
  const isDelivered = (detail?.status ?? order.status)?.toUpperCase() === DELIVERED_STATUS

  /*
   * `discount_amount` is the COMBINED saving, so the coupon part is whatever is left after
   * the quantity offer. There is no separate coupon field — this subtraction is the only
   * way to split them, and it is clamped at zero so a rounding difference can never render
   * a negative "coupon" line.
   */
  const quantityDiscount = priceSummary?.quantityDiscountAmount ?? 0
  const couponDiscount = Math.max(0, (priceSummary?.discountAmount ?? 0) - quantityDiscount)

  const placed = formatOrderDateTime(order.orderedAt)

  /*
   * The right-hand delivery line. A delivered order shows when it arrived; anything else
   * shows the expected date — and `expected_delivery_date` is nullable, so when the admin
   * has not set one the whole line is omitted rather than printing "Invalid Date".
   */
  const deliveredOn = formatOrderDate(order.deliveredAt)
  const expectedBy = formatOrderDate(order.expectedDeliveryDate)
  const deliveryNote = deliveredOn
    ? { label: 'Delivered on', value: deliveredOn }
    : expectedBy
      ? { label: 'Expected by', value: expectedBy }
      : null

  const handleInvoice = async () => {
    if (downloading) return
    setDownloading(true)
    try {
      await downloadOrderInvoice(order.id, order.orderNumber)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to download this invoice.', { variant: 'warning' })
    } finally {
      setDownloading(false)
    }
  }

  const panelId = `order-panel-${order.id}`

  return (
    <article className="border border-zinc-200 bg-white">
      <header className="border-b border-zinc-100">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-4 text-left sm:px-5"
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">Order</p>
            <p className="mt-1 truncate font-sans text-sm font-bold uppercase tracking-[0.1em] text-black">
              {order.orderNumber}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {[placed, order.totalItems !== null ? `${order.totalItems} item${order.totalItems === 1 ? '' : 's'}` : null]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            {deliveryNote ? (
              <div className="hidden text-right sm:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">{deliveryNote.label}</p>
                <p className="mt-0.5 text-xs font-semibold text-black">{deliveryNote.value}</p>
              </div>
            ) : null}
            {order.grandTotal !== null ? (
              <p className="font-sans text-base font-bold text-black">{formatInr(order.grandTotal)}</p>
            ) : null}
            <StatusBadge label={order.statusLabel} />
            <IconChevron className={`size-4 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </button>

        {/* The delivery note moves onto its own line on phones, where the header row above
            has no room for it. */}
        {deliveryNote ? (
          <p className="px-4 pb-3 text-xs text-zinc-600 sm:hidden sm:px-5">
            <span className="font-bold uppercase tracking-[0.12em] text-zinc-500">{deliveryNote.label}</span>{' '}
            {deliveryNote.value}
          </p>
        ) : null}
      </header>

      {open ? (
        <div id={panelId}>
          {order.timeline.length > 0 ? (
            <div className="border-b border-zinc-100 px-4 py-5 sm:px-5">
              <OrderProgress steps={order.timeline} />
            </div>
          ) : null}

          {items.length > 0 ? (
            <ul className="divide-y divide-zinc-100">
              {items.map((item) => (
                <OrderItemRow key={item.key} item={item} canReview={isDelivered} onReview={onReview} />
              ))}
            </ul>
          ) : null}

          {/*
            The money breakdown, from the detail read. Each line is hidden when it is zero,
            so an order with no coupon does not show "Coupon −₹0" and an order with no
            quantity offer does not advertise one that never applied.
          */}
          {priceSummary ? (
            <dl className="space-y-2 border-t border-zinc-100 px-4 py-4 text-sm sm:px-5">
              {priceSummary.subtotal !== null ? (
                <div className="flex justify-between text-zinc-600">
                  <dt>Subtotal</dt>
                  <dd className="tabular-nums">{formatInr(priceSummary.subtotal)}</dd>
                </div>
              ) : null}

              {quantityDiscount > 0 ? (
                <div className="flex justify-between text-burgundy">
                  <dt>Quantity offer</dt>
                  <dd className="tabular-nums">-{formatInr(quantityDiscount)}</dd>
                </div>
              ) : null}

              {couponDiscount > 0 ? (
                <div className="flex justify-between text-burgundy">
                  <dt>Coupon</dt>
                  <dd className="tabular-nums">-{formatInr(couponDiscount)}</dd>
                </div>
              ) : null}

              {priceSummary.shippingAmount !== null && priceSummary.shippingAmount > 0 ? (
                <div className="flex justify-between text-zinc-600">
                  <dt>Shipping</dt>
                  <dd className="tabular-nums">{formatInr(priceSummary.shippingAmount)}</dd>
                </div>
              ) : null}

              {priceSummary.grandTotal !== null ? (
                <div className="flex justify-between border-t border-zinc-200 pt-2 font-bold text-black">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatInr(priceSummary.grandTotal)}</dd>
                </div>
              ) : null}
            </dl>
          ) : detailError ? (
            <p className="border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500 sm:px-5">
              The full breakdown could not be loaded.
            </p>
          ) : null}

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 bg-soft-beige px-4 py-3.5 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <PaymentBadge status={order.paymentStatus} />
              {paymentMethodLabel(order.paymentMethod) ? (
                <span className="text-xs text-zinc-600">{paymentMethodLabel(order.paymentMethod)}</span>
              ) : null}
              {/* Nullable: shown only once a courier has actually been assigned. */}
              {order.trackingId ? (
                <span className="text-xs text-zinc-600">
                  {order.courierName ? `${order.courierName} · ` : ''}
                  {order.trackingId}
                </span>
              ) : null}
            </div>

            <Button variant="outline" size="sm" type="button" onClick={handleInvoice} disabled={downloading}>
              {downloading ? 'Preparing…' : 'Download Invoice'}
            </Button>
          </footer>
        </div>
      ) : null}
    </article>
  )
}

/* ------------------------------------------------------------------ page */

export function OrdersPage() {
  useDocumentTitle('My Orders')

  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [pagination, setPagination] = useState<OrderPagination | null>(null)
  const [emptyMessage, setEmptyMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tab, setTab] = useState<TabKey>('all')
  const [page, setPage] = useState(1)

  /** The order line whose review form is open, or null. */
  const [reviewTarget, setReviewTarget] = useState<ReviewTargetState | null>(null)
  /**
   * Bumped after a review is saved so every OPEN card re-reads its detail.
   *
   * Needed because the thing that changes is `items[].review_id` — the button has to flip
   * from "Write a review" to "Edit your review", and only the detail read knows that.
   */
  const [detailToken, setDetailToken] = useState(0)

  /** Guards against a slow earlier fetch overwriting a newer one. */
  const requestId = useRef(0)

  const load = useCallback(async () => {
    const current = ++requestId.current
    setLoading(true)
    setError(null)

    try {
      const result = await getOrders({
        page,
        page_size: PAGE_SIZE,
        // `search_parameter` is admin-only and is never sent from this screen.
        ...(tab === 'all' ? {} : { order_type: tab }),
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
      setError(readOrderApiError(err, 'Unable to load your orders.'))
    } finally {
      if (current === requestId.current) setLoading(false)
    }
  }, [page, tab])

  useEffect(() => {
    void load()
  }, [load])

  const switchTab = (next: TabKey) => {
    if (next === tab) return
    setTab(next)
    setPage(1)
  }

  const totalPages = pagination?.totalPages ?? null
  const showPagination = Boolean(pagination && (pagination.hasNext || pagination.hasPrevious))

  /*
   * The hero is for an account with NO orders at all, not for a filter that matched
   * nothing: "you haven't placed any orders yet" would be false on the Completed tab of a
   * customer who has orders in progress. A filtered-empty result therefore keeps the
   * normal view, its tabs and its own message, so the shopper can switch back.
   */
  const hasNeverOrdered = !loading && !error && orders.length === 0 && tab === 'all' && page === 1

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col gap-6 px-4 py-10">
      {hasNeverOrdered ? (
        <>
          <h1 className="type-page-title">My Orders</h1>
          <EmptyOrders />
        </>
      ) : (
      <div className="border border-zinc-200 bg-white p-5 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.15)] sm:p-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Orders</p>
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight text-black">My Orders</h1>
        <p className="mt-2 text-sm text-zinc-600">Track every order and download its invoice.</p>

        {/* Filtering is SERVER-side via `order_type`; nothing is filtered locally, so the
            customer is never looking at a partial set of a page. */}
        <div role="tablist" aria-label="Order type" className="mt-5 flex flex-wrap gap-2">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={tab === entry.key}
              onClick={() => switchTab(entry.key)}
              className={`border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-colors ${
                tab === entry.key
                  ? 'border-burgundy bg-burgundy text-cream'
                  : 'border-sand bg-cream text-zinc-700 hover:border-burgundy hover:text-espresso'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div
            className="mt-6 border border-zinc-200 bg-soft-beige p-6 text-sm text-zinc-600"
            role="status"
            aria-live="polite"
          >
            Loading your orders…
          </div>
        ) : error ? (
          <div className="mt-6 border border-zinc-200 bg-soft-beige p-6" role="alert">
            <p className="font-semibold text-black">Unable to load your orders.</p>
            <p className="mt-1.5 text-sm text-zinc-600">{error}</p>
            <Button className="mt-5" onClick={load}>
              Try Again
            </Button>
          </div>
        ) : orders.length === 0 ? (
          <div className="mt-6 border border-zinc-200 bg-soft-beige px-6 py-10 text-center">
            <p className="font-sans text-sm font-bold uppercase tracking-[0.16em] text-black">No orders yet</p>
            {/* The envelope's own `message` is written for end users, so it is shown as-is. */}
            <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-600">
              {emptyMessage || 'Your orders will appear here once you place one.'}
            </p>
            <Link
              to="/shop"
              className="mt-6 inline-block border border-chocolate bg-chocolate px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-white transition-colors hover:bg-zinc-800"
            >
              Shop Now
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-4">
              {orders.map((order, index) => (
                // The most recent order opens by default; the rest stay collapsed. Order
                // is the server's own — re-sorting a single page of a paginated list
                // would reorder within the page only, which is worse than not sorting.
                <OrderCard
                  key={order.id || order.orderNumber}
                  order={order}
                  defaultOpen={index === 0}
                  onReview={setReviewTarget}
                  detailToken={detailToken}
                />
              ))}
            </div>

            {showPagination ? (
              <div className="mt-6 flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={!pagination?.hasPrevious}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs font-semibold uppercase tracking-[0.12em] text-zinc-600">
                  Page {pagination?.page ?? page}
                  {totalPages !== null ? ` of ${totalPages}` : ''}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  disabled={!pagination?.hasNext}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
      )}

      {/*
        One modal for the whole page rather than one per card. It is the same form for
        writing and editing — the only difference is whether it opens on an `order_item_id`
        or an existing `review_id`.
      */}
      {reviewTarget ? (
        <ReviewFormModal
          target={
            reviewTarget.mode === 'edit' && reviewTarget.reviewId !== null
              ? { mode: 'edit', reviewId: reviewTarget.reviewId }
              : { mode: 'create', orderItemId: reviewTarget.orderItemId }
          }
          context={{
            productName: reviewTarget.productName,
            size: reviewTarget.size,
            color: reviewTarget.color,
          }}
          onClose={() => setReviewTarget(null)}
          // Re-reads every open card so its button flips to "Edit your review".
          onSaved={() => setDetailToken((token) => token + 1)}
        />
      ) : null}
    </div>
  )
}
