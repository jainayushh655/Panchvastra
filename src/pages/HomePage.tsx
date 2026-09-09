import { useEffect, useMemo, useState } from 'react'
import { HeroCarousel } from '@/components/HeroCarousel'
import { NewArrivalSection } from '@/components/home/NewArrivalSection'
import { HomeCategoryGrid } from '@/components/home/HomeCategoryGrid'
import { HomeCategoryFilters } from '@/components/home/HomeCategoryFilters'
import { HomeProductGrid } from '@/components/home/HomeProductGrid'
import { getProducts } from '@/api/product'
import { getCategories } from '@/api/category'
import type { Product } from '@/types'
import type { CategoryDto } from '@/types/api/CategoryDto'
import { useAuthCarousel } from '@/hooks/useAuthCarousel'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { mapProduct } from '@/mappers/productMapper'
import { defaultHomepage } from '@/lib/defaultHomepage'
import { categoryNameToSlug } from '@/lib/categorySlug'

export function HomePage() {
  useDocumentTitle('Home')
  const homepage = defaultHomepage()

  // Same hook, same endpoint and same active-only / display_order rules the Login and
  // Signup carousels use — there is one implementation of that behaviour, not two.
  const { images: carouselImages } = useAuthCarousel()

  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<CategoryDto[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)

    Promise.all([getProducts(), getCategories()])
      .then(([dtos, categoryList]) => {
        if (!active) return
        setProducts(dtos.map(mapProduct))
        setCategories(categoryList)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  /**
   * Only categories that actually have products are shown to customers. The product list
   * this page already fetched is the source of truth, so an empty category never reaches
   * the tiles or the filter pills.
   */
  const availableCategories = useMemo(() => {
    const slugsWithProducts = new Set(products.map((product) => product.categorySlug))
    return categories.filter((category) => slugsWithProducts.has(categoryNameToSlug(category.name)))
  }, [categories, products])

  // Default the pill filter to the first AVAILABLE category, and fall back to it if the
  // selected one stops having products.
  useEffect(() => {
    if (availableCategories.length === 0) return
    const slugs = availableCategories.map((category) => categoryNameToSlug(category.name))
    if (activeCategory && slugs.includes(activeCategory)) return
    setActiveCategory(slugs[0])
  }, [availableCategories, activeCategory])

  /**
   * The hero's slides, driven entirely by the Auth Carousel API.
   *
   * One slide per ACTIVE backend image, in `display_order` — so the admin uploading,
   * deactivating, reactivating or reordering an image changes the hero with no frontend
   * deploy, and the count is never hardcoded. The hero's own editorial copy and CTAs are
   * unchanged; each slide reuses the existing copy by position, cycling if the admin adds
   * more images than there are copy blocks.
   *
   * With no active images the hero keeps its layout, copy and CTAs and simply carries no
   * background — `HeroCarousel` already draws its CSS pattern in that case. No placeholder
   * image is substituted, so no hardcoded image URL can reach the hero.
   */
  const heroSlides = useMemo(() => {
    const copy = homepage.heroSlides
    if (carouselImages.length === 0) {
      return [{ ...copy[0], backgroundImage: undefined }]
    }

    return carouselImages.map((image, index) => ({
      ...copy[index % copy.length],
      id: `pv-hero-${image.id}`,
      backgroundImage: image.image_url,
    }))
  }, [carouselImages, homepage.heroSlides])

  const newArrivals = useMemo(() => {
    const isNew = products.filter((p) => p.isNew)
    const rest = products.filter((p) => !p.isNew)
    return [...isNew, ...rest].slice(0, 4)
  }, [products])

  const categoryProducts = useMemo(
    () => (activeCategory ? products.filter((p) => p.categorySlug === activeCategory).slice(0, 8) : []),
    [products, activeCategory],
  )

  return (
    <div>
      <HeroCarousel slides={heroSlides} />
      <NewArrivalSection products={newArrivals} loading={loading} />
      <HomeCategoryGrid categories={availableCategories} />
      <div className="bg-white">
        <HomeCategoryFilters categories={availableCategories} active={activeCategory} onChange={setActiveCategory} />
        <HomeProductGrid products={categoryProducts} loading={loading} />
      </div>
    </div>
  )
}
