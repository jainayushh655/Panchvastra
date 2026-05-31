const fs = require('node:fs/promises')
const path = require('node:path')

const BLOB_PATHNAME = 'orders/orders.json'
const LOCAL_ORDERS = path.join(process.cwd(), 'server', 'data', 'orders.json')

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || ''
}

function emptyStore() {
  return { orders: [], revision: 0 }
}

function normalizeStore(raw) {
  if (!raw || typeof raw !== 'object') return emptyStore()
  return {
    orders: Array.isArray(raw.orders) ? raw.orders : [],
    revision: typeof raw.revision === 'number' ? raw.revision : 0,
  }
}

async function readLocalFile() {
  try {
    const raw = await fs.readFile(LOCAL_ORDERS, 'utf8')
    return normalizeStore(JSON.parse(raw))
  } catch (e) {
    if (e && e.code === 'ENOENT') return null
    throw e
  }
}

async function writeLocalFile(store) {
  await fs.mkdir(path.dirname(LOCAL_ORDERS), { recursive: true })
  await fs.writeFile(LOCAL_ORDERS, JSON.stringify(store), 'utf8')
}

async function fetchBlobJson(url, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const res = await fetch(url, { headers, cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Blob read failed (${res.status})`)
  }
  return normalizeStore(await res.json())
}

async function readBlob() {
  const token = blobToken()
  if (!token) return null

  const { list } = await import('@vercel/blob')
  const { blobs } = await list({ prefix: 'orders/', limit: 20, token })
  const hit =
    blobs.find((b) => b.pathname === BLOB_PATHNAME) ||
    blobs.find((b) => b.pathname.endsWith('/orders.json')) ||
    blobs[0]
  if (!hit) return null

  const url = hit.downloadUrl || hit.url
  if (!url) return null

  return fetchBlobJson(url, token)
}

async function writeBlob(store) {
  const token = blobToken()
  if (!token) return false

  const { put } = await import('@vercel/blob')
  const body = JSON.stringify(store)
  const bytes = Buffer.byteLength(body, 'utf8')
  const sizeMb = bytes / (1024 * 1024)
  if (sizeMb > 4.5) {
    throw new Error(`Orders payload is ${sizeMb.toFixed(1)}MB — too large for Vercel.`)
  }

  await put(BLOB_PATHNAME, body, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    token,
  })
  return true
}

async function readOrders() {
  const blob = await readBlob()
  if (blob) return blob

  const local = await readLocalFile()
  if (local) return local

  return emptyStore()
}

async function writeOrders(store) {
  const normalized = normalizeStore(store)
  const wroteBlob = await writeBlob(normalized)
  if (wroteBlob) return normalized

  if (process.env.VERCEL) {
    throw new Error(
      'Could not save orders to Vercel Blob. Check BLOB_READ_WRITE_TOKEN is set, then redeploy.',
    )
  }

  await writeLocalFile(normalized)
  return normalized
}

/** Newest first */
function sortOrders(orders) {
  return [...orders].sort((a, b) => {
    const ad = Date.parse(a?.order?.date || a?.receivedAt || '') || 0
    const bd = Date.parse(b?.order?.date || b?.receivedAt || '') || 0
    return bd - ad
  })
}

async function appendOrder(entry) {
  const store = await readOrders()
  const orders = sortOrders([entry, ...store.orders.filter((row) => row?.order?.id !== entry.order.id)])
  return writeOrders({ orders, revision: store.revision + 1 })
}

async function updateOrderStatus(orderId, status) {
  const store = await readOrders()
  let found = false
  const orders = store.orders.map((row) => {
    if (row?.order?.id !== orderId) return row
    found = true
    return {
      ...row,
      order: { ...row.order, status },
    }
  })
  if (!found) return null
  return writeOrders({ orders, revision: store.revision + 1 })
}

module.exports = {
  readOrders,
  writeOrders,
  appendOrder,
  updateOrderStatus,
  sortOrders,
}
