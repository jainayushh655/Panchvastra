const { mkdir, readFile, appendFile } = require('node:fs/promises')
const path = require('node:path')

const CSV_HEADER =
  'receivedAt,orderId,email,fullName,phone,line1,line2,city,state,pincode,payment,items,total\n'

function ordersCsvPath() {
  if (process.env.VERCEL || process.env.VERCEL_ENV) return '/tmp/orders.csv'
  const fromEnv = (process.env.ORDERS_CSV_PATH || '').trim()
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv)
  }
  return path.join(process.cwd(), 'server', 'data', 'orders.csv')
}

function csvCell(value) {
  const s = String(value ?? '').replace(/\r\n/g, '\n')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

async function appendOrderCsvRow(filePath, row) {
  await mkdir(path.dirname(filePath), { recursive: true })
  let needsHeader = false
  try {
    await readFile(filePath, 'utf8')
  } catch (e) {
    if (e && e.code === 'ENOENT') needsHeader = true
    else throw e
  }
  const line = [
    csvCell(row.receivedAt),
    csvCell(row.orderId),
    csvCell(row.email),
    csvCell(row.fullName),
    csvCell(row.phone),
    csvCell(row.line1),
    csvCell(row.line2),
    csvCell(row.city),
    csvCell(row.state),
    csvCell(row.pincode),
    csvCell(row.payment),
    csvCell(row.itemsSummary),
    csvCell(String(row.total)),
  ].join(',')
  if (needsHeader) await appendFile(filePath, CSV_HEADER, 'utf8')
  await appendFile(filePath, `${line}\n`, 'utf8')
}

function parseBody(req) {
  const raw = req.body
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return JSON.parse(raw)
    } catch {
      return {}
    }
  }
  return {}
}

async function handlePostOrder(body) {
  const order = body.order
  const addr = body.address
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
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, error: 'INVALID_EMAIL' }
  }
  if (!fullName || fullName.length < 2 || !line1 || !city || !state || pincode.length !== 6 || !phone) {
    return { ok: false, status: 400, error: 'INVALID_ADDRESS' }
  }
  if (!payment) return { ok: false, status: 400, error: 'INVALID_PAYMENT' }

  const itemsSummary = items
    .map((it) => {
      const name = typeof it?.name === 'string' ? it.name : '?'
      const size = typeof it?.size === 'string' ? it.size : ''
      const color = typeof it?.color === 'string' ? it.color : ''
      const qty = typeof it?.quantity === 'number' ? it.quantity : 0
      const price = typeof it?.price === 'number' ? it.price : 0
      return `${[name, size, color].filter(Boolean).join(' / ')} ×${qty} @${price}`
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

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
    return
  }

  try {
    const result = await handlePostOrder(parseBody(req))
    if (!result.ok) {
      res.status(result.status).json({ ok: false, error: result.error })
      return
    }
    res.status(201).json({ ok: true, orderId: result.orderId })
  } catch (err) {
    console.error('[panchvastra-api] orders handler', err)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
}

module.exports = handler
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '96kb',
    },
  },
}
