/**
 * Local API: order logging (CSV for Excel) + admin. Started with `npm run dev`.
 */
import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { createRequire } from 'node:module'
import { handlePostOrder } from '../api/_lib/handlePostOrder'
import { ordersCsvPath } from '../api/_lib/ordersCsvPath'

const require = createRequire(import.meta.url)
const catalog = require('../api/_lib/catalogStorage.js') as typeof import('../api/_lib/catalogStorage.js')

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '10mb' }))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'panchvastra-api' })
})

app.post('/api/orders', async (req, res) => {
  const result = await handlePostOrder(req.body ?? {})
  if (!result.ok) {
    res.status(result.status).json({ ok: false, error: result.error })
    return
  }
  res.status(201).json({ ok: true, orderId: result.orderId })
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
  console.log(`[panchvastra-api] Orders CSV: ${ordersCsvPath()}`)
  console.log(`[panchvastra-api] POST /api/orders`)
  console.log(`[panchvastra-api] GET/PUT /api/catalog`)
})
