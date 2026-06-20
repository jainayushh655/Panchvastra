import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { KeyHighlightsSection } from '@/components/product/KeyHighlightsSection'
import { ProductDetailAccordions } from '@/components/product/ProductDetailAccordions'
import { ProductImageGallery } from '@/components/product/ProductImageGallery'
import { ProductVariantPicker } from '@/components/product/ProductVariantPicker'
import { useCart } from '@/context/CartProvider'
import { useCatalog } from '@/hooks/useCatalog'
import { useCatalogHydrated } from '@/hooks/useCatalogHydrated'
import { catalogApi } from '@/lib/api'
import { formatInr } from '@/lib/format'
import type { Product } from '@/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function ProductDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const catalogHydrated = useCatalogHydrated()
  const { revision } = useCatalog()
  const { addItem } = useCart()
  const [product, setProduct] = useState<Product | null>(null)
  const [variants, setVariants] = useState<Product[]>([])
  const [size, setSize] = useState('')
  const [color, setColor] = useState('')
  const [showCartPopup, setShowCartPopup] = useState(false)

  const hasVariantPicker = variants.length >= 2

  useEffect(() => {
    if (!slug || !catalogHydrated) return
    let cancelled = false
    Promise.all([catalogApi.getBySlug(slug), catalogApi.getSiblingVariants(slug)]).then(([p, sibs]) => {
      if (cancelled) return
      if (!p) {
        navigate('/shop', { replace: true })
        return
      }
      setProduct(p)

      // Sort sibling variants deterministically (by name) so their order
      // remains stable across renders and when switching variants.
      const staticOrderedVariants = Array.isArray(sibs)
        ? [...sibs].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
        : []
      setVariants(staticOrderedVariants)

      setSize(p.sizes.includes('M') ? 'M' : p.sizes[0])
      if (sibs.length < 2) {
        const cols = (p.colors ?? []).filter(Boolean)
        setColor(cols[0] ?? '')
      } else {
        setColor('')
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
    return () => {
      cancelled = true
    }
  }, [slug, revision, navigate, catalogHydrated])

  useDocumentTitle(product?.name ?? 'Product')

  const colorOptions = hasVariantPicker ? [] : (product?.colors ?? []).filter(Boolean)
  const colorOk =
    colorOptions.length === 0 || (Boolean(color) && colorOptions.includes(color))
  const canAdd = Boolean(product && size && product.sizes.includes(size) && colorOk)

  const add = () => {
    if (!product || !size || !colorOk) return
    addItem(product, size, 1, color || undefined)
  }

  const handleAddToCart = () => {
    add()
    setShowCartPopup(true)
    setTimeout(() => setShowCartPopup(false), 2500)
  }

  if (!product) {
    return <div className="p-16 text-center font-sans text-zinc-500">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <ProductImageGallery images={product.images} />

        <div className="sticky top-24 h-fit">
          <h1 className="type-product-detail-title">{product.name}</h1>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="type-price-lg">{formatInr(product.price)}</span>
            {product.compareAtPrice != null && product.compareAtPrice > product.price ? (
              <>
                <span className="text-lg text-zinc-400 line-through">
                  {formatInr(product.compareAtPrice)}
                </span>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-sans text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {Math.round((1 - product.price / product.compareAtPrice) * 100)}% OFF
                </span>
              </>
            ) : null}
          </div>

          <div className="my-6 border-t border-zinc-200 dark:border-zinc-800" />

          {hasVariantPicker ? (
            <ProductVariantPicker current={product} variants={variants} />
          ) : colorOptions.length > 0 ? (
            <div>
              <p className="font-sans text-sm font-semibold text-zinc-900 dark:text-white">
                Available Colors
              </p>
              <div className="mt-4 flex gap-3">
                {colorOptions.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-10 w-10 rounded-full border-4 transition-all ${
                      c === color
                        ? 'scale-110 border-black dark:border-white'
                        : 'border-zinc-200 dark:border-zinc-700'
                    }`}
                    style={{ backgroundColor: c.toLowerCase() }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <div className={hasVariantPicker || colorOptions.length > 0 ? 'mt-8' : ''}>
            <p className="font-sans text-sm font-semibold text-zinc-900 dark:text-white">Select Size</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {product.sizes.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setSize(sz)}
                  className={`flex h-12 min-w-[52px] items-center justify-center rounded-xl border font-sans text-sm font-semibold transition-all ${
                    sz === size
                      ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                      : 'border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200'
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-10">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={!canAdd}
              className="type-btn w-full rounded-xl bg-black px-6 py-4 text-sm text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
            >
              ADD TO CART
            </button>
          </div>

          <KeyHighlightsSection product={product} />
          <ProductDetailAccordions product={product} />
        </div>
      </div>

      {showCartPopup ? (
        <div
          className="fixed top-24 right-6 z-[9999] animate-in slide-in-from-top duration-300"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-black px-5 py-4 text-white shadow-2xl">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 font-sans text-sm font-bold"
              aria-hidden
            >
              ✓
            </div>
            <div>
              <p className="font-sans text-sm font-semibold">Added to cart</p>
              <p className="font-sans text-xs text-zinc-300">Product added successfully</p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
