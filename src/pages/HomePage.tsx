import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { HeroCarousel } from '@/components/HeroCarousel'
import { FeatureDropsSection, FeatureToProductsConnector } from '@/components/home/FeatureDropsSection'
import { ProductCard } from '@/components/ProductCard'
import { useCatalog } from '@/hooks/useCatalog'
import { useCatalogHydrated } from '@/hooks/useCatalogHydrated'
import { catalogApi } from '@/lib/api'
import type { Product } from '@/types'
import { ProductGridSkeleton } from '@/components/shop/ProductGridSkeleton'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

type ShowcaseTab = 'trending' | 'bestseller' | 'newarrival' | 'hotdeals'

const SHOWCASE_TABS: { id: ShowcaseTab; label: string }[] = [
  { id: 'trending', label: 'Trending' },
  { id: 'bestseller', label: 'Best seller' },
  { id: 'newarrival', label: 'New arrival' },
  { id: 'hotdeals', label: 'Hot deals' },
]

export function HomePage() {
  useDocumentTitle('Home')
  const catalogHydrated = useCatalogHydrated()
  const { revision, homepage, products } = useCatalog()
  const [showcase, setShowcase] = useState<Product[]>([])
  const [tab, setTab] = useState<ShowcaseTab>('trending')
  const showShowcaseLoading = !catalogHydrated && products.length === 0

  useEffect(() => {
    if (showShowcaseLoading) return
    catalogApi.getHomeShowcase(tab, 3).then((r) => setShowcase(r.products))
  }, [revision, tab, showShowcaseLoading])

  return (
    <div className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[28rem] bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_42%),linear-gradient(180deg,rgba(255,248,235,0.96),rgba(255,255,255,0))]" />
      <HeroCarousel slides={homepage.heroSlides} />

      <FeatureDropsSection />
      <FeatureToProductsConnector />

      <section className="px-4 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl">

          {/* Section Header */}
          <div className="mb-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#8a7355]">
                Featured Collection
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight text-[#d6b36d] md:text-4xl">
                Discover Our Best Pieces
              </h2>

              <p className="mt-3 max-w-xl text-sm text-zinc-500 md:text-base">
                Curated styles crafted for everyday comfort, premium quality,
                and timeless aesthetics.
              </p>
            </div>

            <Link
              to="/shop"
              className="group inline-flex items-center gap-2 rounded-full border border-[#d8c7a5] bg-white/80 px-4 py-2 text-sm font-semibold text-[#8a7355] shadow-sm backdrop-blur transition-all duration-200 hover:-translate-y-0.5 hover:gap-3 hover:border-[#bda87f] hover:text-[#6f5c44]"
            >
              View All Products
              <span aria-hidden>→</span>
            </Link>
          </div>

          {/* Tabs */}
          <div
            role="tablist"
            aria-label="Product collections"
            className="flex flex-wrap gap-3"
          >
            {SHOWCASE_TABS.map((t) => {
              const selected = tab === t.id

              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setTab(t.id)}
                  className={`rounded-full border px-5 py-2 text-sm font-medium transition-all duration-200 ${selected
                    ? 'border-zinc-950 bg-zinc-950 text-white shadow-[0_18px_35px_-22px_rgba(0,0,0,0.75)]'
                    : 'border-zinc-200 bg-white/90 text-zinc-600 shadow-sm hover:border-zinc-400 hover:text-zinc-900'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          {/* Products */}
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {showShowcaseLoading ? (
              <ProductGridSkeleton count={3} />
            ) : (
              showcase.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
