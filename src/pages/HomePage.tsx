import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { HeroCarousel } from '@/components/HeroCarousel'
import { FeatureDropsSection, FeatureToProductsConnector } from '@/components/home/FeatureDropsSection'
import { ProductCard } from '@/components/ProductCard'
import { useCatalog } from '@/hooks/useCatalog'
import { useCatalogHydrated } from '@/hooks/useCatalogHydrated'
import { catalogApi } from '@/lib/api'
import type { Product } from '@/types'
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
  const { revision, homepage } = useCatalog()
  const [showcase, setShowcase] = useState<Product[]>([])
  const [tab, setTab] = useState<ShowcaseTab>('trending')

  useEffect(() => {
    if (!catalogHydrated) return
    catalogApi.getHomeShowcase(tab, 3).then((r) => setShowcase(r.products))
  }, [revision, tab, catalogHydrated])

  return (
    <div>
      <HeroCarousel slides={homepage.heroSlides} />

      <FeatureDropsSection />
      <FeatureToProductsConnector />

      <section className="bg-white px-4 pb-16 pt-8">
        <div className="mx-auto max-w-6xl">
          <div
            role="tablist"
            aria-label="Product collections"
            className="flex flex-wrap justify-start gap-2"
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
                  className={`rounded-full px-3 py-1 text-sm font-medium leading-none shadow-[0_2px_6px_rgba(0,0,0,0.1)] transition-colors duration-150 ${
                    selected
                      ? 'bg-zinc-950 text-white dark:bg-white dark:text-zinc-950'
                      : 'bg-white text-zinc-500 hover:text-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
                  } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:focus-visible:outline-white`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>

          <div className="mt-4 flex justify-end">
            <Link
              to="/shop"
              className="group inline-flex items-center gap-1 text-sm font-medium text-[#8a7355] transition-colors hover:text-[#6f5c44] dark:text-[#c4a882] dark:hover:text-[#dcc9a8]"
            >
              View all products
              <span
                aria-hidden
                className="inline-block transition-transform duration-200 group-hover:translate-x-0.5"
              >
                →
              </span>
            </Link>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {showcase.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
