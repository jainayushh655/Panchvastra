const {
  readCatalog,
  writeCatalog,
  adminTokenOk,
  parseJsonBody,
} = require('./_lib/catalogStorage')

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Admin-Token')
}

async function handler(req, res) {
  cors(res)

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  try {
    if (req.method === 'GET') {
      const catalog = await readCatalog()
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json(catalog)
      return
    }

    if (req.method === 'PUT') {
      if (!adminTokenOk(req)) {
        res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
        return
      }
      const body = parseJsonBody(req)
      if (!body?.products || !Array.isArray(body.products)) {
        res.status(400).json({ ok: false, error: 'INVALID_CATALOG' })
        return
      }
      const saved = await writeCatalog(body)
      res.status(200).json({ ok: true, revision: saved.revision ?? 0 })
      return
    }

    res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' })
  } catch (err) {
    console.error('[panchvastra-api] catalog', err)
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR', message })
  }
}

module.exports = handler
module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}
