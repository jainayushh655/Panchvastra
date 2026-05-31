import type { OrderLogEntry } from '@/types/orderLog'
import type { Order } from '@/types'
import { getAdminApiToken } from '@/lib/adminAuth'
import { storefrontApiPath } from '@/lib/storefrontApi'

const LOG_PREFIX = '[panchvastra/orders]'

export type AdminOrderRow = OrderLogEntry & {
  payment?: 'cod' | 'upi'
  receivedAt?: string
}

export async function fetchOrdersFromApi(): Promise<AdminOrderRow[]> {
  const token = getAdminApiToken()
  const url = storefrontApiPath('/api/orders')
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      console.error(`${LOG_PREFIX} GET failed`, { status: res.status })
      return []
    }
    const body = (await res.json()) as { orders?: AdminOrderRow[] }
    console.info(`${LOG_PREFIX} GET ok`, { count: body.orders?.length ?? 0 })
    return Array.isArray(body.orders) ? body.orders : []
  } catch (err) {
    console.error(`${LOG_PREFIX} GET network error`, err)
    return []
  }
}

export async function downloadOrdersCsv(): Promise<boolean> {
  const token = getAdminApiToken()
  const url = `${storefrontApiPath('/api/orders')}?format=csv`
  try {
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      console.error(`${LOG_PREFIX} CSV download failed`, { status: res.status })
      return false
    }
    const blob = await res.blob()
    const stamp = new Date().toISOString().slice(0, 10)
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `panchvastra-orders-${stamp}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    return true
  } catch (err) {
    console.error(`${LOG_PREFIX} CSV download error`, err)
    return false
  }
}

export async function updateOrderStatusOnApi(
  orderId: string,
  status: Order['status'],
): Promise<boolean> {
  const token = getAdminApiToken()
  const url = storefrontApiPath('/api/orders')
  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ orderId, status }),
    })
    if (!res.ok) {
      console.error(`${LOG_PREFIX} PATCH failed`, { status: res.status, orderId })
      return false
    }
    console.info(`${LOG_PREFIX} PATCH ok`, { orderId, status })
    return true
  } catch (err) {
    console.error(`${LOG_PREFIX} PATCH network error`, err)
    return false
  }
}
