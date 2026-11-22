import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { KeyHighlightsSection } from '@/components/product/KeyHighlightsSection'
import { ProductDetailView } from '@/components/product/ProductDetailView'
import { env } from '@/lib/env'
import { readKeyHighlights } from '@/lib/keyHighlights'
import { SITE_NAME } from '@/lib/metadata'
import { getSizeChartForProduct } from '@/lib/sizeChart'
import { mapProductDetail } from '@/mappers/productDetailMapper'
import { getProductDetail } from '@/services/server/catalog'
import type { ProductDetailDto, VariantDto } from '@/types/api/ProductDetailDto'

/**
 * The product detail page — a Server Component.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT THE SERVER OWNS HERE
 * ──────────────────────────────────────────────────────────────────────────────
 * The product read, the variant the URL names, the size chart lookup, the metadata, the
 * structured data and the Key Highlights list. Everything that responds to a tap lives in
 * `ProductDetailView` — and because a Client Component is still rendered to HTML on the
 * server, the product name, price, subtitle, colours and sizes are in the markup too.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * A MISSING PRODUCT IS NOW A 404
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite page discovers a failed fetch in the browser and does
 * `navigate('/shop', { replace: true })` — so a dead product link answers 200 with the
 * Shop page, which tells a crawler the URL is fine and quietly loses the signal. Here the
 * read happens before anything is sent, so `notFound()` returns a real 404 with the app's
 * own not-found page. Same visible outcome for a shopper, correct status for everything
 * else.
 */

type Params = { id: string }
type SearchParams = Record<string, string | string[] | undefined>

/** The variant a `?sku=` names, or the product's default, or the first — same rule as the view. */
function resolveVariant(dto: ProductDetailDto, sku: string | null): VariantDto | undefined {
  const variants = dto.variants ?? []
  const bySku = sku ? variants.find((v) => v.sku === sku) : undefined
  if (bySku) return bySku
  return variants.find((v) => v.is_default) ?? variants[0]
}

function readSku(params: SearchParams): string | null {
  const value = params.sku
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

/**
 * Per-product metadata.
 *
 * Everything here comes from the product's own record: its name, its description, its
 * photograph. Nothing is written about a product that the catalogue does not already say.
 *
 * CANONICAL excludes `?sku=`. Every colour of a product is the same page with the same
 * copy — pointing each one at its own canonical would split one product's ranking across
 * however many colours it comes in. The colour stays in the shareable URL and in
 * `og:url`, which is what a person pasting a link actually wants.
 */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  const { id } = await params
  const dto = await getProductDetail(id)

  if (!dto) {
    return { title: 'Product not found', robots: { index: false, follow: false } }
  }

  const sku = readSku(await searchParams)
  const variant = resolveVariant(dto, sku)
  const image = variant?.images?.[0]?.image_url?.trim()
  const canonical = `/product/${dto.id}`
  const shareUrl = sku && variant ? `${canonical}?sku=${encodeURIComponent(variant.sku)}` : canonical

  // The product's own description, trimmed to a length a search result will actually
  // show. No marketing line is generated for a product that has no description.
  const description = dto.description?.trim()
    ? dto.description.trim().slice(0, 300)
    : [dto.category?.name, dto.sub_category?.name].filter(Boolean).join(' · ') || undefined

  return {
    title: dto.name,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: shareUrl,
      siteName: SITE_NAME,
      title: `${dto.name} · ${SITE_NAME}`,
      description,
      locale: 'en_IN',
      ...(image ? { images: [{ url: image, alt: dto.name }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title: `${dto.name} · ${SITE_NAME}`,
      description,
      ...(image ? { images: [image] } : {}),
    },
  }
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<Params>
  searchParams: Promise<SearchParams>
}) {
  const { id } = await params
  const dto = await getProductDetail(id)

  if (!dto) notFound()

  const sku = readSku(await searchParams)
  const variant = resolveVariant(dto, sku)
  const product = mapProductDetail(dto)

  /*
   * Which size chart this product gets, from the catalog relationship the admin
   * maintains. `sub_category_name` is the flat mirror the detail response also carries,
   * used only when the nested object is absent. Null means no chart is configured for
   * this pairing, and the Size Chart control is then not rendered at all rather than
   * showing a wrong one.
   */
  const sizeChart = getSizeChartForProduct(
    dto.category?.name,
    dto.sub_category?.name ?? dto.sub_category_name,
    readKeyHighlights(dto.key_highlights),
  )

  const canonicalPath = `/product/${dto.id}`
  const shareUrl = env.siteUrl
    ? `${env.siteUrl}${canonicalPath}${variant ? `?sku=${encodeURIComponent(variant.sku)}` : ''}`
    : ''

  /*
   * ──────────────────────────────────────────────────────────────────────────
   * PRODUCT STRUCTURED DATA — ONLY WHAT THE BACKEND ACTUALLY SAYS
   * ──────────────────────────────────────────────────────────────────────────
   * Every field below is read off this product's own record: its name, description,
   * images, the selected variant's SKU, colour, price, currency and stock.
   *
   * WHAT IS DELIBERATELY ABSENT, and why it matters: `aggregateRating` and `review`.
   * `mapProduct` fills `rating: 5` and `reviewCount: 0` as placeholders — there is no
   * review system behind them. Emitting a 5-star rating no customer gave would be
   * fabricated review data in a machine-readable format, which is both dishonest and a
   * structured-data policy violation that can get rich results removed for the whole
   * domain. The same goes for `priceValidUntil` and any shipping or return claim that is
   * not configured anywhere.
   *
   * `availability` follows the SELECTED variant's real stock flag, so an out-of-stock
   * colour is not advertised as in stock.
   */
  const images = (variant?.images ?? [])
    .map((img) => img.image_url?.trim())
    .filter((url): url is string => Boolean(url))

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: dto.name,
    ...(dto.description?.trim() ? { description: dto.description.trim() } : {}),
    ...(images.length ? { image: images } : {}),
    ...(env.siteUrl ? { url: `${env.siteUrl}${canonicalPath}` } : {}),
    brand: { '@type': 'Brand', name: SITE_NAME },
    ...(dto.category?.name ? { category: dto.category.name } : {}),
    ...(variant
      ? {
          sku: variant.sku,
          ...(variant.color?.trim() ? { color: variant.color.trim() } : {}),
          offers: {
            '@type': 'Offer',
            price: variant.selling_price,
            priceCurrency: 'INR',
            availability: variant.in_stock
              ? 'https://schema.org/InStock'
              : 'https://schema.org/OutOfStock',
            ...(env.siteUrl ? { url: `${env.siteUrl}${canonicalPath}?sku=${encodeURIComponent(variant.sku)}` } : {}),
          },
        }
      : {}),
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-10 xl:max-w-[88rem] 2xl:max-w-[96rem]">
      <script
        type="application/ld+json"
        // The payload is built above from the backend's own fields; `JSON.stringify`
        // escapes them, and nothing user-authored is concatenated into the string.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <ProductDetailView
        dto={dto}
        product={product}
        initialSku={variant?.sku ?? null}
        sizeChart={sizeChart}
        shareUrl={shareUrl}
        highlights={<KeyHighlightsSection product={product} />}
      />
    </div>
  )
}
