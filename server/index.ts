/**
 * Local API: order logging (CSV for Excel) + admin. Started with `npm run dev`.
 */
import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import path from 'node:path'
import { appendOrderCsvRow } from './orderCsv'

function ordersCsvPath(): string {
  const fromEnv = process.env.ORDERS_CSV_PATH?.trim()
  if (fromEnv) return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv)
  return path.join(process.cwd(), 'server', 'data', 'orders.csv')
}

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '96kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'panchvastra-api' })
})

app.post('/api/orders', async (req, res) => {
  const body = req.body as {
    order?: unknown
    address?: unknown
    payment?: unknown
  }
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
    res.status(400).json({ ok: false, error: 'INVALID_ORDER' })
    return
  }
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !EMAIL_RE.test(email)) {
    res.status(400).json({ ok: false, error: 'INVALID_EMAIL' })
    return
  }
  if (!fullName || fullName.length < 2 || !line1 || !city || !state || pincode.length !== 6 || !phone) {
    res.status(400).json({ ok: false, error: 'INVALID_ADDRESS' })
    return
  }
  if (!payment) {
    res.status(400).json({ ok: false, error: 'INVALID_PAYMENT' })
    return
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
    res.status(500).json({ ok: false, error: 'PERSIST_FAILED' })
    return
  }

  res.status(201).json({ ok: true, orderId })
})

const port = Number(process.env.EMAIL_API_PORT ?? 8787)
app.listen(port, '127.0.0.1', () => {
  console.log(`[panchvastra-api] http://127.0.0.1:${port}`)
  console.log(`[panchvastra-api] Orders CSV: ${ordersCsvPath()}`)
  console.log(`[panchvastra-api] POST /api/orders`)
})
