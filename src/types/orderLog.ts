import type { Order } from '@/types'

export interface OrderLogEntry {
  order: Order
  customerId?: string
  customerEmail?: string
  customerName?: string
}
