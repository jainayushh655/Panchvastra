import { useCallback, useEffect, useState } from 'react'
import { fetchOrdersFromApi, updateOrderStatusOnApi, type AdminOrderRow } from '@/lib/ordersApi'
import type { Order } from '@/types'

export function useAdminOrders() {
  const [orders, setOrders] = useState<AdminOrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const rows = await fetchOrdersFromApi()
    setOrders(rows)
    if (!rows.length) {
      setError(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const setStatus = useCallback(
    async (orderId: string, status: Order['status']) => {
      const ok = await updateOrderStatusOnApi(orderId, status)
      if (!ok) {
        setError('Could not update order status. Try again.')
        return
      }
      setOrders((prev) =>
        prev.map((row) =>
          row.order.id === orderId ? { ...row, order: { ...row.order, status } } : row,
        ),
      )
    },
    [],
  )

  return { orders, loading, error, refresh, setStatus }
}
