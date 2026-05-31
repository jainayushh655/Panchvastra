const { appendOrder, readOrders, sortOrders, updateOrderStatus } = require('./orderStorage')
const { adminTokenOk } = require('./catalogStorage')

const VALID_STATUS = new Set(['processing', 'shipped', 'delivered'])

function parseBody(req) {
  const raw = req.body
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return null
}

function validateAndBuildEntry(body) {
  const order = body?.order
  const addr = body?.address
  const orderId = typeof order?.id === 'string' ? order.id.trim() : ''
  const date = typeof order?.date === 'string' ? order.date : ''
  const total = typeof order?.total === 'number' && Number.isFinite(order.total) ? order.total : NaN
  const items = Array.isArray(order?.items) ? order.items : []
  const status =
    typeof order?.status === 'string' && VALID_STATUS.has(order.status) ? order.status : 'processing'

  const email = typeof addr?.email === 'string' ? addr.email.trim() : ''
  const fullName = typeof addr?.fullName === 'string' ? addr.fullName.trim() : ''
  const line1 = typeof addr?.line1 === 'string' ? addr.line1.trim() : ''
  const line2 = typeof addr?.line2 === 'string' ? addr.line2.trim() : ''
  const city = typeof addr?.city === 'string' ? addr.city.trim() : ''
  const state = typeof addr?.state === 'string' ? addr.state.trim() : ''
  const pincode = typeof addr?.pincode === 'string' ? addr.pincode.replace(/\D/g, '').slice(0, 6) : ''
  const phone = typeof addr?.phone === 'string' ? addr.phone.trim() : ''
  const payment = body?.payment === 'cod' || body?.payment === 'upi' ? body.payment : ''

  if (!orderId || !date || !Number.isFinite(total) || !items.length) {
    return { ok: false, status: 400, error: 'INVALID_ORDER' }
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, error: 'INVALID_EMAIL' }
  }
  if (!fullName || fullName.length < 2 || !line1 || !city || !state || pincode.length !== 6 || !phone) {
    return { ok: false, status: 400, error: 'INVALID_ADDRESS' }
  }
  if (!payment) {
    return { ok: false, status: 400, error: 'INVALID_PAYMENT' }
  }

  const normalizedItems = items.map((it) => ({
    productId: typeof it?.productId === 'string' ? it.productId : '',
    name: typeof it?.name === 'string' ? it.name : '?',
    size: typeof it?.size === 'string' ? it.size : '',
    ...(typeof it?.color === 'string' && it.color ? { color: it.color } : {}),
    quantity: typeof it?.quantity === 'number' ? it.quantity : 0,
    price: typeof it?.price === 'number' ? it.price : 0,
  }))

  return {
    ok: true,
    entry: {
      receivedAt: new Date().toISOString(),
      order: {
        id: orderId,
        date,
        total,
        status,
        items: normalizedItems,
      },
      address: { email, fullName, line1, line2, city, state, pincode, phone },
      payment,
      customerEmail: email,
      customerName: fullName,
    },
  }
}

async function postOrder(body) {
  const built = validateAndBuildEntry(body)
  if (!built.ok) return built

  try {
    await appendOrder(built.entry)
    return { ok: true, status: 201, orderId: built.entry.order.id }
  } catch (err) {
    console.error('[panchvastra-api] orders append', err)
    const message = err instanceof Error ? err.message : 'PERSIST_FAILED'
    return { ok: false, status: 500, error: message.includes('Blob') ? message : 'PERSIST_FAILED' }
  }
}

async function getOrdersForAdmin() {
  const store = await readOrders()
  return sortOrders(store.orders).map((row) => ({
    order: row.order,
    customerEmail: row.customerEmail ?? row.address?.email,
    customerName: row.customerName ?? row.address?.fullName,
    payment: row.payment,
    address: row.address,
    receivedAt: row.receivedAt,
  }))
}

async function patchOrderStatus(body) {
  const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : ''
  const status = typeof body?.status === 'string' ? body.status : ''
  if (!orderId) return { ok: false, status: 400, error: 'INVALID_ORDER_ID' }
  if (!VALID_STATUS.has(status)) return { ok: false, status: 400, error: 'INVALID_STATUS' }

  try {
    const updated = await updateOrderStatus(orderId, status)
    if (!updated) return { ok: false, status: 404, error: 'NOT_FOUND' }
    return { ok: true, status: 200, orderId, status }
  } catch (err) {
    console.error('[panchvastra-api] orders patch', err)
    return { ok: false, status: 500, error: 'INTERNAL_ERROR' }
  }
}

module.exports = {
  postOrder,
  getOrdersForAdmin,
  patchOrderStatus,
  parseBody,
  adminTokenOk,
}
