import { useMemo } from 'react'
import { useCatalog } from '@/hooks/useCatalog'
import { getOrderLog, updateOrderStatus } from '@/lib/catalogStore'
import { formatInr } from '@/lib/format'
import type { Order } from '@/types'

export function AdminOrders() {
  const { revision } = useCatalog()

  const rows = useMemo(() => getOrderLog(), [revision])

  const setStat = (id: string, status: Order['status']) => {
    updateOrderStatus(id, status)
  }

  return (
    <div>
      <h1 className="type-page-title text-white">Orders</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Orders from this browser after checkout. Rows are also appended on the server to{' '}
        <code className="text-zinc-600">server/data/orders.csv</code> (open in Excel).
      </p>
      <div className="mt-8 space-y-6">
        {rows.length === 0 ? (
          <p className="text-zinc-500">No orders logged yet.</p>
        ) : (
          rows.map(({ order, customerEmail, customerName }) => (
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
