const fs = require('node:fs/promises')
const path = require('node:path')
const { CSV_HEADER, entryToCsvRow, ordersToCsv } = require('./orderCsv')

const BLOB_CSV_PATH = 'orders/orders.csv'
const LOCAL_CSV = path.join(process.cwd(), 'server', 'data', 'orders.csv')

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || ''
}

async function readLocalCsv() {
  try {
    return await fs.readFile(LOCAL_CSV, 'utf8')
  } catch (e) {
    if (e && e.code === 'ENOENT') return ''
    throw e
  }
}

async function writeLocalCsv(content) {
  await fs.mkdir(path.dirname(LOCAL_CSV), { recursive: true })
  await fs.writeFile(LOCAL_CSV, content, 'utf8')
}

async function readBlobCsv() {
  const token = blobToken()
  if (!token) return null

  const { list } = await import('@vercel/blob')
  const { blobs } = await list({ prefix: 'orders/', limit: 20, token })
  const hit =
    blobs.find((b) => b.pathname === BLOB_CSV_PATH) ||
    blobs.find((b) => b.pathname.endsWith('/orders.csv'))
  if (!hit) return ''

  const url = hit.downloadUrl || hit.url
  if (!url) return ''

  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const res = await fetch(url, { headers, cache: 'no-store' })
  if (!res.ok) return ''
  return res.text()
}

async function writeBlobCsv(content) {
  const token = blobToken()
  if (!token) return false

  const { put } = await import('@vercel/blob')
  await put(BLOB_CSV_PATH, content, {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'text/csv',
    token,
  })
  return true
}

async function readCsvFile() {
  const blob = await readBlobCsv()
  if (blob !== null) return blob
  return readLocalCsv()
}

async function writeCsvFile(content) {
  const wroteBlob = await writeBlobCsv(content)
  if (wroteBlob) return

  if (process.env.VERCEL) {
    throw new Error('Could not save orders CSV to Vercel Blob.')
  }

  await writeLocalCsv(content)
}

/** Append one checkout row to the running Excel/CSV log. */
async function appendOrderCsvEntry(entry) {
  let existing = await readCsvFile()
  if (!existing.trim()) existing = CSV_HEADER
  else if (!existing.endsWith('\n')) existing += '\n'

  const line = entryToCsvRow(entry)
  await writeCsvFile(`${existing}${line}\n`)
}

/** Regenerate CSV from JSON store (includes latest status values). */
async function exportOrdersCsv(orders) {
  return ordersToCsv(orders)
}

module.exports = {
  appendOrderCsvEntry,
  exportOrdersCsv,
  readCsvFile,
  LOCAL_CSV,
}
