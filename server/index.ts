/**
 * Local API: order logging + admin. Started with `npm run dev`.
 */
import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const catalog = require('../api/_lib/catalogStorage.js') as typeof import('../api/_lib/catalogStorage.js')
const orders = require('../api/_lib/ordersHandler.js') as typeof import('../api/_lib/ordersHandler.js')

type OtpEntry = {
  code: string
  expiresAt: number
}

const otpStore = new Map<string, OtpEntry>()

function normalizeEmail(email: string): string {
  return String(email ?? '').trim().toLowerCase()
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function createOtpCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'panchvastra-api' })
})

app.post('/api/orders', async (req, res) => {
  const result = await orders.postOrder(req.body ?? {})
  if (!result.ok) {
    res.status(result.status).json({ ok: false, error: result.error })
    return
  }
  res.status(201).json({ ok: true, orderId: result.orderId })
})

app.get('/api/orders', async (req, res) => {
  if (!orders.adminTokenOk(req)) {
    res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
    return
  }
  try {
    if (req.query.format === 'csv') {
      const csv = await orders.getOrdersCsvForAdmin()
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="panchvastra-orders.csv"')
      res.send(csv)
      return
    }
    const rows = await orders.getOrdersForAdmin()
    res.setHeader('Cache-Control', 'no-store')
    res.json({ ok: true, orders: rows })
  } catch (err) {
    console.error('[panchvastra-api] GET orders', err)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.patch('/api/orders', async (req, res) => {
  if (!orders.adminTokenOk(req)) {
    res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
    return
  }
  const result = await orders.patchOrderStatus(req.body ?? {})
  if (!result.ok) {
    res.status(result.status).json({ ok: false, error: result.error })
    return
  }
  res.json({ ok: true, orderId: result.orderId, status: result.status })
})

app.post('/api/auth/otp/send', (req, res) => {
  const email = normalizeEmail(typeof req.body?.email === 'string' ? req.body.email : '')
  if (!email || !isValidEmail(email)) {
    res.status(400).json({ ok: false, error: 'Enter a valid email address.' })
    return
  }

  const code = createOtpCode()
  otpStore.set(email, { code, expiresAt: Date.now() + 60_000 })
  console.info(`[panchvastra-api] OTP for ${email}: ${code}`)
  res.json({ ok: true, message: 'OTP sent' })
})

app.post('/api/auth/otp/verify', (req, res) => {
  const email = normalizeEmail(typeof req.body?.email === 'string' ? req.body.email : '')
  const otp = String(req.body?.otp ?? '').trim()

  if (!email || !isValidEmail(email)) {
    res.status(400).json({ ok: false, error: 'Enter a valid email address.' })
    return
  }

  if (!/^\d{6}$/.test(otp)) {
    res.status(400).json({ ok: false, error: 'Enter the 6-digit OTP.' })
    return
  }

  const entry = otpStore.get(email)
  if (!entry || entry.expiresAt < Date.now()) {
    otpStore.delete(email)
    res.status(400).json({ ok: false, error: 'OTP expired. Please request a new one.' })
    return
  }

  if (entry.code !== otp) {
    res.status(400).json({ ok: false, error: 'Incorrect OTP. Please try again.' })
    return
  }

  otpStore.delete(email)
  res.json({ ok: true, message: 'OTP verified' })
})

app.get('/api/catalog', async (_req, res) => {
  try {
    const data = await catalog.readCatalog()
    res.setHeader('Cache-Control', 'no-store')
    res.json(data)
  } catch (err) {
    console.error('[panchvastra-api] GET catalog', err)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.put('/api/catalog', async (req, res) => {
  if (!catalog.adminTokenOk(req)) {
    res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
    return
  }
  const body = req.body
  if (!body?.products || !Array.isArray(body.products)) {
    res.status(400).json({ ok: false, error: 'INVALID_CATALOG' })
    return
  }
  try {
    const saved = await catalog.writeCatalog(body)
    res.json({ ok: true, revision: saved.revision ?? 0 })
  } catch (err) {
    console.error('[panchvastra-api] PUT catalog', err)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

const port = Number(process.env.EMAIL_API_PORT ?? 8787)
app.listen(port, '127.0.0.1', () => {
  console.log(`[panchvastra-api] http://127.0.0.1:${port}`)
  console.log(`[panchvastra-api] Orders store: server/data/orders.json (local) / Vercel Blob (production)`)
  console.log(`[panchvastra-api] GET/POST/PATCH /api/orders`)
  console.log(`[panchvastra-api] GET/PUT /api/catalog`)
})
