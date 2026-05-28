import type { VercelRequest, VercelResponse } from '@vercel/node'
import { handlePostOrder, type PostOrderBody } from './_lib/handlePostOrder'

function parseBody(req: VercelRequest): PostOrderBody {
  const raw = req.body
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) {
    return raw as PostOrderBody
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return JSON.parse(raw) as PostOrderBody
    } catch {
      return {}
    }
  }
  return {}
}

async function handler(req: VercelRequest, res: VercelResponse) {
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
