import type { Metadata } from 'next'
import { ShopBrowser } from '@/components/shop/ShopBrowser'
import { categoryHeadingFor, readerFor, resolveShopSelection, subCategoryOptionsFor, SHOP_PAGE_SIZE } from '@/lib/shopQuery'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/metadata'
import { mapProduct } from '@/mappers/productMapper'
import { getAllProductDtos, getCategoryList, getProductPage } from '@/services/server/catalog'

/**
 * The Shop page — a Server Component that renders page 1 of the current query into the
 * HTML, with a client island on top for the controls and infinite scroll.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT CHANGED FROM THE VITE PAGE, AND WHAT DID NOT
 * ──────────────────────────────────────────────────────────────────────────────
 * Not changed: the query parameters and their meanings (`q`, `category`, `subcategory`,
 * `size`, `min`, `max`, `sort`), which filters the backend applies and which stay on the
 * client, the 20-per-page size, the sub-category options being derived from the FULL
 * catalogue, the heading, every empty/coming-soon/error state, and the product card.
 *
 * Changed: where the work happens. The Vite page mounts empty and fires three browser
 * requests; this one resolves the URL and fetches on the server, so the first paint is
 * the real grid. There is no skeleton on arrival and no layout shift as products replace
 * placeholders.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE `key` ON THE ISLAND IS LOAD-BEARING
 * ──────────────────────────────────────────────────────────────────────────────
 * `selection.serverKey` is the backend query as a string. Keying the island on it means a
 * genuinely different query REMOUNTS the browser state — appended pages, paging cursor,
 * in-flight flags — while a change that does not alter the backend query (the price band,
 * switching between the two client-only sorts) keeps it. That single line replaces the
 * reset effect, the request-id guard and the "newest request wins" logic the Vite page
 * needs, and it reproduces that page's behaviour of not discarding loaded pages for a
 * client-side refinement.
 *
 * `searchParams` makes this route dynamically rendered, which is correct: there are more
 * filter combinations than are worth prerendering, and the underlying fetches are cached
 * for `REVALIDATE.catalogue` anyway, so repeat visits to the same filter do not hit the
 * backend again.
 */

type SearchParams = Record<string, string | string[] | undefined>

/**
 * Per-URL metadata.
 *
 * The title names the selected category, so `/shop?category=hoodie` is "Hoodie · Shop ·
 * PANCHVASTRA" rather than every filter sharing one title. The copy is the category's own
 * name from the backend — nothing is written about it.
 *
 * CANONICAL. Only `category` and `subcategory` survive into the canonical URL. Those two
 * select a different SET of products — a collection worth indexing on its own — while
 * `size`, `min`/`max`, `sort` and `q` are refinements of that same collection, and
 * letting each combination claim its own canonical would split one page's ranking across
 * dozens of near-duplicate URLs. `q` in particular would make a canonical out of whatever
 * anyone typed.
 */
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  const params = await searchParams
  const read = readerFor(params)
  const categories = await getCategoryList()

  // The sub-category list is only needed to validate the slug for the canonical; passing
  // the options it is validated against keeps this consistent with the page itself.
  const facetProducts = (await getAllProductDtos()).map(mapProduct)
  const preliminary = resolveShopSelection(read, categories, [])
  const subCategoryOptions = subCategoryOptionsFor(facetProducts, preliminary.category)
  const selection = resolveShopSelection(read, categories, subCategoryOptions)

  const heading = categoryHeadingFor(categories, selection.category)
  const title = selection.category === 'all' ? 'Shop' : `${heading} · Shop`

  const canonicalParams = new URLSearchParams()
  if (selection.category !== 'all') canonicalParams.set('category', selection.category)
  if (selection.subcategory !== 'all') canonicalParams.set('subcategory', selection.subcategory)
  const canonical = canonicalParams.toString() ? `/shop?${canonicalParams}` : '/shop'

  return {
    title,
    description: SITE_DESCRIPTION,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: SITE_NAME,
      title: `${title} · ${SITE_NAME}`,
      description: SITE_DESCRIPTION,
      locale: 'en_IN',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} · ${SITE_NAME}`,
      description: SITE_DESCRIPTION,
    },
  }
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams
  const read = readerFor(params)

  /*
   * The categories and the full catalogue first, because the URL cannot be resolved
   * without them: `?category=` is validated against the real category list, and
   * `?subcategory=` against the options derived from every product — including products
   * on later pages, which is why this reads the whole catalogue rather than page 1.
   *
   * Both are cached reads (`REVALIDATE.taxonomy` / `REVALIDATE.catalogue`), so this is one
   * backend round trip per window, not per visitor.
   */
  const [categories, facetDtos] = await Promise.all([getCategoryList(), getAllProductDtos()])
  const facetProducts = facetDtos.map(mapProduct)

  // Two passes: the category decides which sub-categories exist, and the sub-category is
  // then validated against those. Same order the Vite page resolves them in.
  const preliminary = resolveShopSelection(read, categories, [])
  const subCategoryOptions = subCategoryOptionsFor(facetProducts, preliminary.category)
  const selection = resolveShopSelection(read, categories, subCategoryOptions)

  const { products, pagination, error } = await getProductPage({
    ...selection.serverParams,
    page: 1,
    page_size: SHOP_PAGE_SIZE,
  })

  const initialProducts = products.map(mapProduct)
  const heading = categoryHeadingFor(categories, selection.category)

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {/* Server-rendered, so the page's subject is in the markup rather than being
          written in by JavaScript after load. */}
      <h1 className="type-page-title">{heading}</h1>

      <ShopBrowser
        key={selection.serverKey}
        categories={categories}
        subCategoryOptions={subCategoryOptions}
        initialProducts={initialProducts}
        initialHasNext={pagination?.has_next === true && initialProducts.length > 0}
        initialError={error}
        serverKey={selection.serverKey}
      />
    </div>
  )
}
