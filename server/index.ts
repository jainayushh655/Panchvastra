/**
 * Local API: order logging (CSV for Excel) + admin. Started with `npm run dev`.
 */
import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import { handlePostOrder } from './handlePostOrder'
import { ordersCsvPath } from './ordersCsvPath'

const app = express()
app.use(cors({ origin: true }))
app.use(express.json({ limit: '96kb' }))

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

const port = Number(process.env.EMAIL_API_PORT ?? 8787)
app.listen(port, '127.0.0.1', () => {
  console.log(`[panchvastra-api] http://127.0.0.1:${port}`)
  console.log(`[panchvastra-api] Orders CSV: ${ordersCsvPath()}`)
  console.log(`[panchvastra-api] POST /api/orders`)
})
