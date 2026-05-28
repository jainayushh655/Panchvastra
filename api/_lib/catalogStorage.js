const fs = require('node:fs/promises')
const path = require('node:path')
const { getSeedCatalog } = require('./catalogSeed')

const BLOB_PATHNAME = 'catalog.json'
const LOCAL_CATALOG = path.join(process.cwd(), 'server', 'data', 'catalog.json')

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || ''
}

function normalizeCatalog(raw) {
  const seed = getSeedCatalog()
  if (!raw || typeof raw !== 'object') return seed
  return {
    ...raw,
    products: Array.isArray(raw.products) && raw.products.length ? raw.products : seed.products,
    categories: Array.isArray(raw.categories) && raw.categories.length ? raw.categories : seed.categories,
    homepage: raw.homepage && typeof raw.homepage === 'object' ? raw.homepage : seed.homepage,
    revision: typeof raw.revision === 'number' ? raw.revision : 0,
  }
}

async function readLocalFile() {
  try {
    const raw = await fs.readFile(LOCAL_CATALOG, 'utf8')
    return normalizeCatalog(JSON.parse(raw))
  } catch (e) {
    if (e && e.code === 'ENOENT') return null
    throw e
  }
}

async function writeLocalFile(snapshot) {
  await fs.mkdir(path.dirname(LOCAL_CATALOG), { recursive: true })
  await fs.writeFile(LOCAL_CATALOG, JSON.stringify(snapshot), 'utf8')
}

async function fetchBlobJson(url, token) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const res = await fetch(url, { headers, cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Blob read failed (${res.status})`)
  }
  return normalizeCatalog(await res.json())
}

async function readBlob() {
  const token = blobToken()
  if (!token) return null

  const { list } = await import('@vercel/blob')
  const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 20, token })
  const hit =
    blobs.find((b) => b.pathname === BLOB_PATHNAME) ||
    blobs.find((b) => b.pathname.endsWith('/' + BLOB_PATHNAME)) ||
    blobs[0]
  if (!hit) return null

  const url = hit.downloadUrl || hit.url
  if (!url) return null

  return fetchBlobJson(url, token)
}

async function writeBlob(snapshot) {
  const token = blobToken()
  if (!token) return false

  const { put } = await import('@vercel/blob')
  const body = JSON.stringify(snapshot)
  await put(BLOB_PATHNAME, body, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    token,
  })
  return true
}

async function readCatalog() {
  const blob = await readBlob()
  if (blob) return blob

  const local = await readLocalFile()
  if (local) return local

  return normalizeCatalog(getSeedCatalog())
}

async function writeCatalog(snapshot) {
  const normalized = normalizeCatalog(snapshot)
  const wroteBlob = await writeBlob(normalized)
  if (wroteBlob) return normalized

  if (process.env.VERCEL) {
    throw new Error(
      'Could not save catalog to Vercel Blob. Check that panchvastra-blob is connected and BLOB_READ_WRITE_TOKEN is set, then redeploy.',
    )
  }

  await writeLocalFile(normalized)
  return normalized
}

function adminTokenOk(req) {
  const expected = (process.env.ADMIN_API_TOKEN || process.env.VITE_ADMIN_TOKEN || '').trim()
  if (!expected) return false
  const auth = String(req.headers.authorization || '')
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const header = req.headers['x-admin-token']
  return bearer === expected || header === expected
}

function parseJsonBody(req) {
  const raw = req.body
  if (raw && typeof raw === 'object' && !Buffer.isBuffer(raw)) return raw
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }
  return null
}

module.exports = {
  readCatalog,
  writeCatalog,
  adminTokenOk,
  parseJsonBody,
  normalizeCatalog,
}
