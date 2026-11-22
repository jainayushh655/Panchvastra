import type { Metadata } from 'next'
import { HeroCarousel } from '@/components/HeroCarousel'
import { CustomPieceBanner } from '@/components/home/CustomPieceBanner'
import { HomeCategoryBrowser } from '@/components/home/HomeCategoryBrowser'
import { HomeCategoryGrid } from '@/components/home/HomeCategoryGrid'
import { NewArrivalSection } from '@/components/home/NewArrivalSection'
import { categoryNameToSlug } from '@/lib/categorySlug'
import { defaultHeroSlides } from '@/lib/homepageHero'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/metadata'
import { mapProduct } from '@/mappers/productMapper'
import {
  getActiveCarouselImages,
  getCategoryList,
  getProductDtos,
} from '@/services/server/catalog'
import type { CategoryDto } from '@/types/api/CategoryDto'
import type { HomepageHeroSlide } from '@/types/homepage'
import type { Product } from '@/types'

/**
 * The homepage — a Server Component.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT THIS REPLACES
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite `HomePage` is a client component that mounts empty, fires three browser
 * requests (products, categories, carousel), paints skeletons, and then fills in. Every
 * section's content is therefore invisible to a crawler that does not run JavaScript, and
 * the first paint reflows twice.
 *
 * Here the same three reads happen on the server, in parallel, before the HTML is sent.
 * The sections, the product names and prices, the category tiles and every internal link
 * are in the markup. The only JavaScript the page needs is the hero (a carousel) and the
 * category pills (a filter) — see `HomeCategoryBrowser`.
 *
 * API CONTRACTS ARE UNCHANGED: the same three endpoints, the same `sort_by=display_order`
 * on the product list, the same active-only/`display_order` carousel rules, the same
 * `mapProduct` mapper. Nothing authenticated is read, which is why these can be server
 * reads at all — see `services/server/catalog.ts`.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * RENDERING MODE
 * ──────────────────────────────────────────────────────────────────────────────
 * Static with revalidation. The three reads carry their own `revalidate` windows, and the
 * page-level `revalidate` below bounds the shell itself — so the homepage is served from
 * the edge as static HTML and refreshes on its own without a deploy. Nothing on it is
 * per-visitor: the cart and wishlist badges live in the header, which is a client island
 * that hydrates after load.
 *
 * In an environment with no API origin configured (local development against no backend,
 * and the CI build) the three reads degrade to empty lists and this page prerenders its
 * shell with the empty states each section already has. That is what lets `npm run build`
 * pass offline.
 */

export const revalidate = 300

/**
 * Homepage metadata.
 *
 * The title keeps the format the live site uses — `useDocumentTitle('Home')` produces
 * "Home · PANCHVASTRA", and the root `title.template` reproduces it exactly.
 *
 * The description is the one the live site already serves from its `index.html`; no new
 * marketing copy is written here, and no claim is made that the business has not already
 * published about itself. Open Graph and Twitter inherit the same text, so a shared link
 * says what the page says.
 *
 * `alternates.canonical` is the fix for the duplicate-URL cost that `skipTrailingSlashRedirect`
 * introduced (`/` and no other form): it names one address for this page whatever path a
 * crawler arrives on. It resolves against `metadataBase` when `NEXT_PUBLIC_SITE_URL` is
 * set and is emitted relative otherwise.
 *
 * ⚠️ THE SITE-WIDE `noindex` FROM PHASE 2 IS STILL IN FORCE (see `lib/metadata.ts`): this
 * application runs alongside the live Vite storefront, and an indexed preview would
 * compete with it for the same queries. Everything an indexer needs is in place and
 * correct; lifting the block is a cutover decision, not a homepage one. Flagged for
 * approval in the Phase 4A report.
 */
export const metadata: Metadata = {
  title: 'Home',
  description: SITE_DESCRIPTION,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    url: '/',
    siteName: SITE_NAME,
    title: `Home · ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
    locale: 'en_IN',
  },
  twitter: {
    card: 'summary_large_image',
    title: `Home · ${SITE_NAME}`,
    description: SITE_DESCRIPTION,
  },
}

/** New Arrivals: flagged products first, then the rest, capped at 4. */
function pickNewArrivals(products: Product[]): Product[] {
  const isNew = products.filter((p) => p.isNew)
  const rest = products.filter((p) => !p.isNew)
  return [...isNew, ...rest].slice(0, 4)
}

/**
 * Categories that actually have products.
 *
 * This drives the FILTER PILLS and, through them, which products the grid below shows —
 * a pill for an empty category would filter the homepage grid down to nothing, so those
 * stay out of it.
 *
 * The category TILES are a different question and use the full list: see where
 * `HomeCategoryGrid` is rendered.
 */
function pickAvailableCategories(categories: CategoryDto[], products: Product[]): CategoryDto[] {
  const slugsWithProducts = new Set(products.map((product) => product.categorySlug))
  return categories.filter((category) => slugsWithProducts.has(categoryNameToSlug(category.name)))
}

/**
 * Category slug -> up to 8 products, in the order the backend returned them.
 *
 * The same list the Vite page computes on every pill change, computed once here instead.
 * Only the available categories are grouped, so nothing is serialised that no pill can
 * reach.
 */
function groupProductsByCategory(
  categories: CategoryDto[],
  products: Product[],
): Record<string, Product[]> {
  const groups: Record<string, Product[]> = {}

  for (const category of categories) {
    const slug = categoryNameToSlug(category.name)
    groups[slug] = products.filter((product) => product.categorySlug === slug).slice(0, 8)
  }

  return groups
}

/**
 * The hero's slides, driven entirely by the Auth Carousel API.
 *
 * One slide per ACTIVE backend image, in `display_order` — so the admin uploading,
 * deactivating, reactivating or reordering an image changes the hero with no frontend
 * deploy, and the count is never hardcoded. The hero's own editorial copy and CTA are
 * unchanged; each slide reuses the existing copy by position, cycling if the admin adds
 * more images than there are copy blocks.
 *
 * With no active images the hero keeps its layout and CTA and simply carries no
 * background — `HeroCarousel` draws its CSS pattern in that case. No placeholder image is
 * substituted, so no hardcoded image URL can reach the hero.
 */
function buildHeroSlides(imageUrls: { id: number; image_url: string }[]): HomepageHeroSlide[] {
  const copy = defaultHeroSlides()

  if (imageUrls.length === 0) {
    return [{ ...copy[0], backgroundImage: undefined }]
  }

  return imageUrls.map((image, index) => ({
    ...copy[index % copy.length],
    id: `pv-hero-${image.id}`,
    backgroundImage: image.image_url,
  }))
}

export default async function HomePage() {
  /*
   * One round trip's worth of latency, not three: the reads are independent, so they are
   * awaited together. This mirrors the Vite page, which also issues all three at once
   * (`Promise.all` for products + categories, and the carousel hook alongside).
   *
   * `sort_by=display_order` asks the BACKEND for the admin's curated order. Neither
   * homepage section re-sorts, so both inherit it: the category grid shows it directly,
   * and New Arrivals keeps its own "new first" grouping with each group internally in
   * curated order.
   */
  const [productDtos, categories, carouselImages] = await Promise.all([
    getProductDtos({ sort_by: 'display_order' }),
    getCategoryList(),
    getActiveCarouselImages(),
  ])

  const products = productDtos.map(mapProduct)
  const availableCategories = pickAvailableCategories(categories, products)
  const productsByCategory = groupProductsByCategory(availableCategories, products)
  const initialCategory = availableCategories.length
    ? categoryNameToSlug(availableCategories[0].name)
    : ''

  return (
    <div>
      <HeroCarousel slides={buildHeroSlides(carouselImages)} />

      {/*
        `h1` for the page's own first heading.

        The Vite homepage has NO `h1` at all: the hero renders only a button, so the first
        heading on the page is the `h2` "New Arrival" and the document outline starts at
        level 2 with no stated subject.

        This supplies one, and its text is deliberately just the brand name — the single
        word the page is already about, and the same wordmark the header displays. No
        descriptive or promotional line is written here, because that would be inventing
        SEO copy rather than migrating the page. It is `sr-only` so the visual design is
        untouched: the hero still opens the page, and every section keeps its own visible
        heading exactly as it is.
      */}
      <h1 className="sr-only">{SITE_NAME}</h1>

      <NewArrivalSection products={pickNewArrivals(products)} />

      {/*
        Every category, not just the ones with stock.

        The tiles are navigation: adding a second category in the admin panel should bring
        this section back immediately, which it would not do if a brand-new category had to
        wait for its first product to count. A tile for an empty category still leads
        somewhere useful — the Shop page shows that category's "coming soon" state.
      */}
      <HomeCategoryGrid categories={categories} />

      <HomeCategoryBrowser
        categories={availableCategories}
        productsByCategory={productsByCategory}
        initialCategory={initialCategory}
        customStudio={<CustomPieceBanner />}
      />
    </div>
  )
}
