import { useAdminOrders } from '@/hooks/useAdminOrders'
import { formatInr } from '@/lib/format'
import type { Order } from '@/types'

export function AdminOrders() {
  const { orders, loading, error, refresh, setStatus } = useAdminOrders()

  const setStat = (id: string, status: Order['status']) => {
    void setStatus(id, status)
  }

  return (
    <div>
      <h1 className="type-page-title text-white">Orders</h1>
      <p className="mt-2 text-sm text-zinc-400">
        All orders from every device — stored centrally via{' '}
        <code className="text-orange-300">/api/orders</code> (Vercel Blob in production).
      </p>
      {error ? (
        <p className="mt-4 rounded-xl border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {error}{' '}
          <button type="button" className="underline" onClick={() => void refresh()}>
            Retry
          </button>
        </p>
      ) : null}
      <div className="mt-8 space-y-6">
        {loading ? (
          <p className="text-zinc-500">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="text-zinc-500">No orders yet.</p>
        ) : (
          orders.map(({ order, customerEmail, customerName, payment }) => (
            <article
              key={order.id + order.date}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 text-zinc-200"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-orange-400">{order.id}</p>
                  <p className="text-xs text-zinc-500">{new Date(order.date).toLocaleString('en-IN')}</p>
                  {(customerName ?? customerEmail) ? (
                    <p className="mt-2 text-xs text-zinc-400">
                      {customerName}
                      {customerEmail ? ` · ${customerEmail}` : ''}
                      {payment ? ` · ${payment.toUpperCase()}` : ''}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-bold text-white">{formatInr(order.total)}</span>
                  <select
                    value={order.status}
                    onChange={(e) => setStat(order.id, e.target.value as Order['status'])}
                    className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs capitalize text-white"
                  >
                    <option value="processing">processing</option>
                    <option value="shipped">shipped</option>
                    <option value="delivered">delivered</option>
                  </select>
                </div>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-zinc-400">
                {order.items.map((it, i) => (
                  <li key={`${it.productId}-${String(i)}`}>
                    {it.name} ({[it.size, it.color].filter(Boolean).join(', ')}) × {it.quantity} ·{' '}
                    {formatInr(it.price)}
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </div>
    </div>
  )
}
