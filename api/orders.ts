import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePostOrder } from '../server/handlePostOrder'

export default async function handler(req: VercelRequest, res: VercelResponse) {
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

  const result = await handlePostOrder(req.body ?? {})
  if (!result.ok) {
    res.status(result.status).json({ ok: false, error: result.error })
    return
  }

  res.status(201).json({ ok: true, orderId: result.orderId })
}
