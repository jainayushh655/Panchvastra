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
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { mapProduct } from '@/mappers/productMapper'
import { defaultHomepage } from '@/lib/defaultHomepage'
import { categoryNameToSlug } from '@/lib/categorySlug'

export function HomePage() {
  useDocumentTitle('Home')
  const homepage = defaultHomepage()

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

  // Default the pill filter to the first real category once it loads.
  useEffect(() => {
    if (activeCategory || categories.length === 0) return
    setActiveCategory(categoryNameToSlug(categories[0].name))
  }, [categories, activeCategory])

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
      <HeroCarousel slides={homepage.heroSlides} />
      <NewArrivalSection products={newArrivals} loading={loading} />
      <HomeCategoryGrid categories={categories} />
      <div className="bg-white">
        <HomeCategoryFilters categories={categories} active={activeCategory} onChange={setActiveCategory} />
        <HomeProductGrid products={categoryProducts} loading={loading} />
      </div>
    </div>
  )
}
