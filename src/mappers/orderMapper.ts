import type { OrderDto, OrderItemDto } from '@/types/api/OrderDto'
import type { CustomerOrder, CustomerOrderItem, OrderPageInfo } from '@/types/customerOrder'

/**
 * Maps GET /v1/orders/ responses onto the customer order-history model.
 *
 * All backend-specific field resolution lives here so no component reaches into raw
 * response shapes. Because the 200 payload is not published (see `OrderDto`), each logical
 * field is read from a candidate list grounded in this backend's confirmed conventions,
 * and anything unmatched stays empty/null so the UI can omit it instead of inventing it.
 */

function firstString(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  }
  return ''
}

/** Accepts numbers and numeric strings (DRF serialises Decimal fields as strings). */
function firstNumber(source: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return null
}

function firstArray(source: Record<string, unknown>, keys: string[]): unknown[] {
  for (const key of keys) {
    const value = source[key]
    if (Array.isArray(value)) return value
  }
  return []
}

const ITEM_NAME_KEYS = ['product_name', 'name', 'title']
const ITEM_IMAGE_KEYS = ['primary_image', 'image', 'image_url', 'product_image']
const ITEM_PRICE_KEYS = ['selling_price', 'price', 'unit_price', 'mrp']

function mapOrderItem(dto: OrderItemDto, index: number): CustomerOrderItem {
  const record = dto as Record<string, unknown>
  const productId = firstString(record, ['product_id', 'id'])

  return {
    key: firstString(record, ['id', 'order_item_id', 'cart_item_id']) || `${productId || 'item'}-${index}`,
    productId,
    name: firstString(record, ITEM_NAME_KEYS),
    imageUrl: firstString(record, ITEM_IMAGE_KEYS),
    size: firstString(record, ['size']),
    color: firstString(record, ['color']),
    quantity: firstNumber(record, ['quantity', 'qty']),
    price: firstNumber(record, ITEM_PRICE_KEYS),
  }
}

const ORDER_DATE_KEYS = ['created_at', 'order_date', 'placed_at', 'created', 'date']
const ORDER_TOTAL_KEYS = ['total_amount', 'total_price', 'grand_total', 'final_amount', 'total', 'amount']
const ORDER_ITEMS_KEYS = ['items', 'order_items', 'products']

/** API record → the model the Orders page consumes. */
export function mapOrder(dto: OrderDto, index = 0): CustomerOrder {
  const record = dto as Record<string, unknown>
  const id = firstString(record, ['id', 'order_id'])
  const reference = firstString(record, ['order_number', 'order_code']) || id || `#${index + 1}`

  return {
    id,
    reference,
    date: firstString(record, ORDER_DATE_KEYS),
    status: firstString(record, ['status', 'order_status']),
    total: firstNumber(record, ORDER_TOTAL_KEYS),
    items: firstArray(record, ORDER_ITEMS_KEYS).map((item, itemIndex) =>
      mapOrderItem((item ?? {}) as OrderItemDto, itemIndex),
    ),
  }
}

/**
 * Locates the order array inside the response.
 *
 * This backend wraps payloads in `{ success, message, data }` and puts list payloads
 * directly in `data` (confirmed on categories_management). DRF's own pagination instead
 * nests them under `results`, so both are accepted, plus one level of nesting, so an
 * unexpected wrapper degrades to an empty list rather than crashing the page.
 */
export function readOrderList(payload: unknown): OrderDto[] {
  if (Array.isArray(payload)) return payload as OrderDto[]
  if (!payload || typeof payload !== 'object') return []

  const record = payload as Record<string, unknown>
  for (const key of ['results', 'orders', 'data']) {
    const value = record[key]
    if (Array.isArray(value)) return value as OrderDto[]
  }

  // A single-order response (GET /v1/orders/?id=<id>) is a bare order object. This must be
  // checked before the generic array scan below, otherwise such an order's own `items`
  // array would be mistaken for the order list.
  if ('id' in record || 'order_id' in record) return [record as OrderDto]

  for (const value of Object.values(record)) {
    if (Array.isArray(value)) return value as OrderDto[]
  }

  return []
}

/**
 * Reads pagination metadata, reporting a further page ONLY when the response explicitly
 * says so. Nothing is inferred: when the backend sends no pagination fields this returns
 * `hasNextPage: false` and the page shows no pagination control at all.
 */
export function readPageInfo(payload: unknown, requestedPage: number): OrderPageInfo {
  const empty: OrderPageInfo = { hasNextPage: false, totalCount: null }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return empty

  const record = payload as Record<string, unknown>

  // DRF PageNumberPagination: `next` is a URL string, or null on the last page.
  if (typeof record.next === 'string' && record.next.trim()) return { hasNextPage: true, totalCount: firstNumber(record, ['count', 'total_count', 'total']) }
  if (record.next === null) return { hasNextPage: false, totalCount: firstNumber(record, ['count', 'total_count', 'total']) }

  if (typeof record.has_next === 'boolean') {
    return { hasNextPage: record.has_next, totalCount: firstNumber(record, ['count', 'total_count', 'total']) }
  }

  const totalPages = firstNumber(record, ['total_pages', 'num_pages', 'page_count'])
  if (totalPages !== null) {
    const current = firstNumber(record, ['page', 'current_page']) ?? requestedPage
    return { hasNextPage: current < totalPages, totalCount: firstNumber(record, ['count', 'total_count', 'total']) }
  }

  return empty
}
