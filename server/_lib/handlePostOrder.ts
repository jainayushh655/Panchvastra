import { appendOrderCsvRow } from './orderCsv'
import { ordersCsvPath } from './ordersCsvPath'

export type PostOrderBody = {
  order?: unknown
  address?: unknown
  payment?: unknown
}

export type PostOrderResult =
  | { ok: true; status: 201; orderId: string }
  | { ok: false; status: 400 | 500; error: string }

export async function handlePostOrder(body: PostOrderBody): Promise<PostOrderResult> {
  const order = body.order as
    | {
        id?: unknown
        date?: unknown
        total?: unknown
        items?: unknown
      }
    | undefined
  const addr = body.address as
    | {
        email?: unknown
        fullName?: unknown
        line1?: unknown
        line2?: unknown
        city?: unknown
        state?: unknown
        pincode?: unknown
        phone?: unknown
      }
    | undefined

  const orderId = typeof order?.id === 'string' ? order.id.trim() : ''
  const date = typeof order?.date === 'string' ? order.date : ''
  const total = typeof order?.total === 'number' && Number.isFinite(order.total) ? order.total : NaN
  const items = Array.isArray(order?.items) ? order.items : []

  const email = typeof addr?.email === 'string' ? addr.email.trim() : ''
  const fullName = typeof addr?.fullName === 'string' ? addr.fullName.trim() : ''
  const line1 = typeof addr?.line1 === 'string' ? addr.line1.trim() : ''
  const line2 = typeof addr?.line2 === 'string' ? addr.line2.trim() : ''
  const city = typeof addr?.city === 'string' ? addr.city.trim() : ''
  const state = typeof addr?.state === 'string' ? addr.state.trim() : ''
  const pincode = typeof addr?.pincode === 'string' ? addr.pincode.replace(/\D/g, '').slice(0, 6) : ''
  const phone = typeof addr?.phone === 'string' ? addr.phone.trim() : ''
  const payment = body.payment === 'cod' || body.payment === 'upi' ? body.payment : ''

  if (!orderId || !date || !Number.isFinite(total) || !items.length) {
    return { ok: false, status: 400, error: 'INVALID_ORDER' }
  }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !EMAIL_RE.test(email)) {
    return { ok: false, status: 400, error: 'INVALID_EMAIL' }
  }
  if (!fullName || fullName.length < 2 || !line1 || !city || !state || pincode.length !== 6 || !phone) {
    return { ok: false, status: 400, error: 'INVALID_ADDRESS' }
  }
  if (!payment) {
    return { ok: false, status: 400, error: 'INVALID_PAYMENT' }
  }

  const itemsSummary = items
    .map((it: unknown) => {
      const row = it as { name?: unknown; size?: unknown; color?: unknown; quantity?: unknown; price?: unknown }
      const name = typeof row.name === 'string' ? row.name : '?'
      const size = typeof row.size === 'string' ? row.size : ''
      const color = typeof row.color === 'string' ? row.color : ''
      const qty = typeof row.quantity === 'number' ? row.quantity : 0
      const price = typeof row.price === 'number' ? row.price : 0
      const bits = [name, size, color].filter(Boolean)
      return `${bits.join(' / ')} ×${qty} @${price}`
    })
    .join(' | ')

  try {
    await appendOrderCsvRow(ordersCsvPath(), {
      receivedAt: new Date().toISOString(),
      orderId,
      email,
      fullName,
      phone,
      line1,
      line2,
      city,
      state,
      pincode,
      payment,
      itemsSummary,
      total,
    })
  } catch (err) {
    console.error('[panchvastra-api] orders csv', err)
    return { ok: false, status: 500, error: 'PERSIST_FAILED' }
  }

  return { ok: true, status: 201, orderId }
}
