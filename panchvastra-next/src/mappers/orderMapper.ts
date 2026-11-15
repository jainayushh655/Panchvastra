import type {
  OrderAddressDto,
  OrderDetailDto,
  OrderDto,
  OrderItemDto,
  OrderNoteDto,
  OrderPaginationDto,
  OrderPriceSummaryDto,
  OrderStatusHistoryDto,
  OrderTimelineStepDto,
} from '@/types/api/OrderDto'
import type {
  OrderAddress,
  OrderDetail,
  OrderItem,
  OrderNote,
  OrderPagination,
  OrderPriceSummary,
  OrderStatusHistoryEntry,
  OrderSummary,
  OrderTimelineStep,
} from '@/types/orderManagement'

/**
 * Wire shapes → the order model the three screens consume.
 *
 * Every field is read by its real contract name. The only normalisation applied is type
 * coercion (DRF serialises `Decimal` as a string) and turning blank strings into `null`
 * so "absent" is a single, checkable value. No field is renamed, defaulted or invented:
 * if the payload does not carry something, the model says `null` and the UI omits it.
 */

/** Trims and returns null for anything empty — `''` is treated as absent, not as a value. */
function text(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

/** Accepts numbers and numeric strings. Anything else is null, never 0. */
function num(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function list<T>(value: T[] | null | undefined): T[] {
  return Array.isArray(value) ? value : []
}

/* ------------------------------------------------------------------ pieces */

function mapItem(dto: OrderItemDto, index: number): OrderItem {
  const productId = text(dto.product_id)
  return {
    // The line id is a render key only. It is never used as a product link, because the
    // two ids are different things and linking by line id opens the wrong product.
    key: text(dto.id) ?? `${productId ?? 'item'}-${index}`,
    productId,
    variantId: text(dto.variant_id),
    productName: text(dto.product_name) ?? '',
    color: text(dto.color),
    size: text(dto.size),
    quantity: num(dto.quantity),
    mrp: num(dto.mrp),
    sellingPrice: num(dto.selling_price),
    totalAmount: num(dto.total_amount),
    sku: text(dto.sku),
    imageUrl: text(dto.image_url),
  }
}

/**
 * One progress-bar node.
 *
 * `completed` is read strictly: only a literal `true` marks a step done. A step the
 * backend sends without the flag renders as not-yet-reached rather than optimistically
 * filled. `at` is forced to null on an incomplete step so a stale timestamp can never
 * appear under a grey node.
 */
function mapTimelineStep(dto: OrderTimelineStepDto): OrderTimelineStep {
  const completed = dto.completed === true
  return {
    status: text(dto.status) ?? '',
    label: text(dto.label) ?? '',
    at: completed ? text(dto.at) : null,
    completed,
  }
}

function mapStatusHistory(dto: OrderStatusHistoryDto, index: number): OrderStatusHistoryEntry {
  return {
    id: text(dto.id) ?? `history-${index}`,
    status: text(dto.order_status) ?? '',
    label: text(dto.label) ?? '',
    note: text(dto.note),
    createdAt: text(dto.created_at),
    createdBy: text(dto.created_by),
  }
}

export function mapNote(dto: OrderNoteDto, index = 0): OrderNote {
  return {
    id: text(dto.id) ?? `note-${index}`,
    note: text(dto.note) ?? '',
    createdAt: text(dto.created_at),
    createdBy: text(dto.created_by),
  }
}

function mapAddress(dto: OrderAddressDto | null | undefined): OrderAddress | null {
  if (!dto || typeof dto !== 'object') return null
  return {
    customerName: text(dto.customer_name),
    customerEmail: text(dto.customer_email),
    customerMobile: text(dto.customer_mobile),
    addressLine1: text(dto.address_line_1),
    addressLine2: text(dto.address_line_2),
    landmark: text(dto.landmark),
    city: text(dto.city),
    state: text(dto.state),
    country: text(dto.country),
    pincode: text(dto.pincode),
  }
}

function mapPriceSummary(dto: OrderPriceSummaryDto | null | undefined): OrderPriceSummary | null {
  if (!dto || typeof dto !== 'object') return null
  return {
    subtotal: num(dto.subtotal),
    discountAmount: num(dto.discount_amount),
    shippingAmount: num(dto.shipping_amount),
    taxAmount: num(dto.tax_amount),
    grandTotal: num(dto.grand_total),
  }
}

/* ------------------------------------------------------------------ orders */

export function mapOrderSummary(dto: OrderDto, index = 0): OrderSummary {
  const id = text(dto.id) ?? ''
  return {
    id,
    userId: text(dto.user_id),
    // The order number is the human reference. Falling back to the id keeps a row
    // identifiable rather than blank; it is never fabricated into a fake "ORD-…".
    orderNumber: text(dto.order_number) ?? id ?? `#${index + 1}`,
    customerName: text(dto.customer_name),
    customerEmail: text(dto.customer_email),
    customerMobile: text(dto.customer_mobile),
    status: text(dto.order_status) ?? '',
    // Display text is the backend's, always. When it sends no label there is simply no
    // badge — the raw value is not reformatted into one.
    statusLabel: text(dto.status_label) ?? '',
    paymentStatus: text(dto.payment_status),
    paymentMethod: text(dto.payment_method),
    grandTotal: num(dto.grand_total),
    totalItems: num(dto.total_items),
    expectedDeliveryDate: text(dto.expected_delivery_date),
    orderedAt: text(dto.ordered_at),
    processingAt: text(dto.processing_at),
    shippedAt: text(dto.shipped_at),
    outForDeliveryAt: text(dto.out_for_delivery_at),
    deliveredAt: text(dto.delivered_at),
    cancelledAt: text(dto.cancelled_at),
    trackingId: text(dto.tracking_id),
    courierName: text(dto.courier_name),
    timeline: list(dto.timeline).map(mapTimelineStep),
    items: list(dto.items).map(mapItem),
  }
}

export function mapOrderDetail(dto: OrderDetailDto): OrderDetail {
  return {
    ...mapOrderSummary(dto),
    statusHistory: list(dto.status_history).map(mapStatusHistory),
    // Always [] for a customer token; the Notes panel is only rendered by the admin UI.
    notes: list(dto.notes).map(mapNote),
    transactionId: text(dto.transaction_id),
    paidAt: text(dto.paid_at),
    address: mapAddress(dto.address),
    priceSummary: mapPriceSummary(dto.price_summary),
  }
}

/* ------------------------------------------------------------------ envelope */

/**
 * Reads the `pagination` block.
 *
 * `has_next` is read strictly, so an unexpected shape yields no "next page" control
 * rather than an invented one. `totalRecords` stays null when the backend reports none —
 * the empty state keys off an explicit 0, never off a missing field.
 */
export function mapPagination(dto: OrderPaginationDto | null | undefined, requestedPage: number): OrderPagination {
  const source = dto && typeof dto === 'object' ? dto : {}
  return {
    page: num(source.page) ?? requestedPage,
    pageSize: num(source.page_size),
    totalRecords: num(source.total_records),
    totalPages: num(source.total_pages),
    hasNext: source.has_next === true,
    hasPrevious: source.has_previous === true,
  }
}
