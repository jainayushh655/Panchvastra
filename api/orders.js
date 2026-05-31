const {
  postOrder,
  getOrdersForAdmin,
  patchOrderStatus,
  parseBody,
  adminTokenOk,
} = require('./_lib/ordersHandler')

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token')
}

async function handler(req, res) {
  cors(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  try {
    if (req.method === 'POST') {
      const result = await postOrder(parseBody(req))
      if (!result.ok) {
        res.status(result.status).json({ ok: false, error: result.error })
        return
      }
      res.status(201).json({ ok: true, orderId: result.orderId })
      return
    }

    if (req.method === 'GET') {
      if (!adminTokenOk(req)) {
        res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
        return
      }
      const orders = await getOrdersForAdmin()
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ ok: true, orders })
      return
    }

    if (req.method === 'PATCH') {
      if (!adminTokenOk(req)) {
        res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
        return
      }
      const result = await patchOrderStatus(parseBody(req))
      if (!result.ok) {
        res.status(result.status).json({ ok: false, error: result.error })
        return
      }
      res.status(200).json({ ok: true, orderId: result.orderId, status: result.status })
      return
    }

    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  } catch (err) {
    console.error('[panchvastra-api] orders handler', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ ok: false, error: message, code: 'INTERNAL_ERROR' })
  }
}

module.exports = handler
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '256kb',
    },
  },
}
