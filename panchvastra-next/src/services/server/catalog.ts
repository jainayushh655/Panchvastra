import { ENDPOINTS } from '@/services/endpoints'
import { REVALIDATE, ServerApiError, serverGetData, serverGetPage } from '@/services/server/serverApi'
import type { AuthCarouselDto } from '@/types/api/AuthCarouselDto'
import type { CategoryDto } from '@/types/api/CategoryDto'
import type { Pagination } from '@/services/http/pagination'
import type { ProductDetailDto } from '@/types/api/ProductDetailDto'
import type { ProductDto } from '@/types/api/ProductDto'
import type { ProductQueryParams, ProductSortBy } from '@/types/api/ProductQuery'

/**
 * Public catalogue reads for Server Components.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THESE EXIST
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite homepage fetches products, categories and the carousel from the BROWSER, in a
 * `useEffect`, and paints skeletons until they land. Every one of those three reads is
 * anonymous — no token, same response for everyone — so moving them to the server costs
 * nothing in behaviour and buys the two things the audit wanted from this migration:
 * the homepage's content is in the server-rendered HTML (crawlable), and there is no
 * loading flash or layout shift on first paint.
 *
 * The request on the wire is unchanged: same paths from `ENDPOINTS`, same query
 * parameters, same envelope. The backend is not touched.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY EVERY FUNCTION DEGRADES TO AN EMPTY LIST INSTEAD OF THROWING
 * ──────────────────────────────────────────────────────────────────────────────
 * This mirrors the Vite homepage exactly. There, a failed carousel read is caught and
 * leaves no slides (`useAuthCarousel` — "decorative content: fail closed to no slides,
 * never break the page"), and a failed product/category read leaves both lists empty
 * because the page only has a `.finally`. The homepage has always rendered its shell with
 * empty sections rather than an error screen, and each section already has copy for that
 * state ("No products available").
 *
 * Throwing instead would hand the whole homepage to `error.tsx` over a decorative image,
 * and would also mean `next build` cannot prerender the page in an environment with no
 * API origin configured — which is exactly the environment this migration is developed in.
 * The reason is logged server-side, where a developer sees it; the shopper sees the page.
 *
 * Caching is Next's, per `REVALIDATE`: the catalogue window for products, the taxonomy
 * window for categories, the decorative window for the carousel. Tags are attached so a
 * Phase 5 admin save can `revalidateTag` instead of waiting out the window.
 */

/** Logs why a read degraded, without putting a backend message on the page. */
function warn(what: string, error: unknown): void {
  const reason = error instanceof Error ? error.message : String(error)
  console.warn(`[catalog] ${what} unavailable, rendering without it: ${reason}`)
}

/**
 * GET /v1/products_management/ for a storefront surface.
 *
 * `sort_by` is passed through so a caller asks the BACKEND for the order it wants, which
 * is what the Vite homepage does (`sort_by=display_order`, the admin's curated order) and
 * why neither homepage section sorts afterwards.
 */
export async function getProductDtos(
  params: { sort_by?: ProductSortBy; page_size?: number } = {},
): Promise<ProductDto[]> {
  try {
    const data = await serverGetData<ProductDto[]>(ENDPOINTS.products, {
      params,
      revalidate: REVALIDATE.catalogue,
      tags: ['products'],
    })
    return Array.isArray(data) ? data : []
  } catch (error) {
    warn('product list', error)
    return []
  }
}

/** GET /v1/categories_management/ — the public category list, in backend order. */
export async function getCategoryList(): Promise<CategoryDto[]> {
  try {
    const data = await serverGetData<CategoryDto[]>(ENDPOINTS.categories, {
      revalidate: REVALIDATE.taxonomy,
      tags: ['categories'],
    })
    return Array.isArray(data) ? data : []
  } catch (error) {
    warn('category list', error)
    return []
  }
}

/** Keeps only well-formed rows, so a malformed record can never render a broken image. */
function toCarouselRows(payload: unknown): AuthCarouselDto[] {
  if (!Array.isArray(payload)) return []

  return payload.filter(
    (row): row is AuthCarouselDto =>
      !!row &&
      typeof row === 'object' &&
      typeof (row as AuthCarouselDto).id === 'number' &&
      typeof (row as AuthCarouselDto).image_url === 'string' &&
      (row as AuthCarouselDto).image_url.trim().length > 0,
  )
}

/** Ascending `display_order`; ties fall back to `id` so the order is always deterministic. */
function byDisplayOrder(a: AuthCarouselDto, b: AuthCarouselDto): number {
  const orderA = typeof a.display_order === 'number' ? a.display_order : Number.MAX_SAFE_INTEGER
  const orderB = typeof b.display_order === 'number' ? b.display_order : Number.MAX_SAFE_INTEGER
  return orderA === orderB ? a.id - b.id : orderA - orderB
}

/**
 * GET /v1/auth_carousel/ for the storefront — the hero's slides.
 *
 * The validation, the `is_active` re-check and the sort are carried over verbatim from
 * the Vite `getActiveAuthCarouselImages`. The backend already returns active images only
 * for an anonymous request, and this read IS anonymous, but the re-check stays: it is
 * what guarantees an inactive image cannot reach the storefront, and dropping it because
 * the request happens to be anonymous now would be removing a guard for the wrong reason.
 */
export async function getActiveCarouselImages(): Promise<AuthCarouselDto[]> {
  try {
    const data = await serverGetData<AuthCarouselDto[]>(ENDPOINTS.authCarousel, {
      revalidate: REVALIDATE.decorative,
      tags: ['auth-carousel'],
    })
    return toCarouselRows(data)
      .filter((row) => row.is_active !== false)
      .sort(byDisplayOrder)
  } catch (error) {
    warn('hero carousel', error)
    return []
  }
}

/* ------------------------------------------------------------------ shop + detail */

/**
 * ONE page of GET /v1/products_management/, with the pagination block beside it.
 *
 * The Shop page renders page 1 from here, on the server, and the browser asks for page 2
 * onward through `services/products.ts`. Both send the same parameters — they build them
 * from the same `resolveShopSelection` — so an appended page always belongs with the page
 * above it.
 *
 * `pagination` is returned as the backend sent it and is never fabricated: infinite
 * scroll follows its `has_next`, so a response without the block simply stops paging
 * rather than guessing from counts.
 */
export async function getProductPage(
  params: ProductQueryParams,
): Promise<{ products: ProductDto[]; pagination: Pagination | null; error: string | null }> {
  try {
    const page = await serverGetPage<ProductDto>(ENDPOINTS.products, {
      params: params as Record<string, string | number | boolean | null | undefined>,
      revalidate: REVALIDATE.catalogue,
      tags: ['products'],
    })
    return { products: page.items, pagination: page.pagination, error: null }
  } catch (error) {
    warn('product page', error)
    /*
     * This one REPORTS its failure as well as degrading, which the homepage reads do not.
     * The Shop page distinguishes "nothing matched your filters" from "the request
     * failed" — it has a separate error panel with a retry — and collapsing a failure
     * into an empty grid would tell the shopper their filters found nothing when the
     * truth is the catalogue could not be read. The message is the backend's own, already
     * filtered for 5xx bodies by `serverGet`.
     */
    return {
      products: [],
      pagination: null,
      error: error instanceof Error ? error.message : 'Unable to load products.',
    }
  }
}

/**
 * Every product matching `params`, by following `has_next` across pages.
 *
 * Used where a partial catalogue would give a wrong ANSWER rather than just a short list:
 * the Shop page derives its Sub Category options this way, and deriving them from page 1
 * alone would hide any sub-category whose only products sit on a later page.
 *
 * `pageSize` is deliberately large so this is one request for a catalogue of this size,
 * and `maxPages` is a hard stop so a backend that always reported `has_next` could never
 * spin here. Both values are the Vite ones.
 */
export async function getAllProductDtos(
  params: ProductQueryParams = {},
  { pageSize = 100, maxPages = 20 }: { pageSize?: number; maxPages?: number } = {},
): Promise<ProductDto[]> {
  const all: ProductDto[] = []

  for (let page = 1; page <= maxPages; page += 1) {
    const { products, pagination } = await getProductPage({ ...params, page, page_size: pageSize })
    all.push(...products)

    // Stop on an explicit "no more", and also on a short/empty page so a response with no
    // pagination block ends the loop instead of being paged forever.
    if (pagination?.has_next !== true || products.length === 0) break
  }

  return all
}

/**
 * GET /v1/products_management/?id=<id> — one product, with its variants.
 *
 * This one does NOT degrade to an empty value: a product page with no product is not a
 * page. It returns null and the route calls `notFound()`, which is the correct 404 for a
 * product that does not exist — something the Vite app could not do, because it discovered
 * the failure in the browser and redirected to `/shop`.
 */
export async function getProductDetail(id: string): Promise<ProductDetailDto | null> {
  try {
    const data = await serverGetData<ProductDetailDto>(ENDPOINTS.products, {
      params: { id },
      revalidate: REVALIDATE.catalogue,
      tags: ['products', `product-${id}`],
    })
    // The list endpoint answers `?id=` with the detail object; a missing product comes
    // back as a 404 (handled below) or an empty envelope (handled here).
    return data && typeof data === 'object' && 'id' in data ? data : null
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) return null
    warn(`product ${id}`, error)
    return null
  }
}
