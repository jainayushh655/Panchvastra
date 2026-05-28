const fs = require('node:fs')
const path = require('node:path')

function seedPath() {
  return path.join(process.cwd(), 'data', 'catalog.seed.json')
}

/** Default catalog when no remote copy exists yet. */
function getSeedCatalog() {
  try {
    const raw = fs.readFileSync(seedPath(), 'utf8')
    const parsed = JSON.parse(raw)
    if (parsed?.products?.length) return parsed
  } catch {
    /* missing seed file */
  }
  return {
    products: [],
    categories: [],
    homepage: {},
    revision: 0,
  }
}

module.exports = { getSeedCatalog, seedPath }
