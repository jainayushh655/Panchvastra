/**
 * Writes data/catalog.seed.json from current mock CMS defaults.
 * Run: npx tsx scripts/write-catalog-seed.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { CATEGORIES } from '../src/data/categories'
import { MOCK_PRODUCTS } from '../src/data/mockProducts'
import { defaultHeroSlides, normalizeHomepageContent } from '../src/lib/homepageHero'

function defaultHomepage() {
  return normalizeHomepageContent(
    {
      heroEyebrow: 'Gen Z · India-first',
      heroTitle: 'Built for fits that live on feed & off it.',
      heroSub:
        'PANCHVASTRA is modular streetwear: regular tees, oversized silhouettes, and shorts — with room to grow into whatever the algorithm wants next.',
      heroSlides: defaultHeroSlides(),
      featuredSectionTitle: 'Featured drops',
      trendingSectionTitle: 'Trending now',
      featuredTiles: [],
      banners: {},
      newsletterTitle: 'Join the list',
      newsletterSub: 'Early access to collabs & restocks. No spam — we respect the inbox.',
    },
    normalizeHomepageContent({ heroSlides: defaultHeroSlides() }, { heroSlides: defaultHeroSlides() }),
  )
}

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
