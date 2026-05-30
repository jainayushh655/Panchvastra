/**
 * Writes data/catalog.seed.json from current mock CMS defaults.
 * Run: npx tsx scripts/write-catalog-seed.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { CATEGORIES } from '../src/data/categories'
import { MOCK_PRODUCTS } from '../src/data/mockProducts'
import { defaultHomepage } from '../src/lib/defaultHomepage'

const out = {
  products: MOCK_PRODUCTS,
  categories: CATEGORIES,
  homepage: defaultHomepage(),
  revision: 0,
}

const dir = path.join(process.cwd(), 'data')
mkdirSync(dir, { recursive: true })
writeFileSync(path.join(dir, 'catalog.seed.json'), JSON.stringify(out, null, 2), 'utf8')
console.log('Wrote data/catalog.seed.json')
