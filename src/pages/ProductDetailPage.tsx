import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { addToCart } from '@/api/cart'
import { getProductById } from '@/api/product'
import { resolveReviewEligibility } from '@/api/reviewEligibility'
import { ColorSwatchPicker } from '@/components/product/ColorSwatchPicker'
import { NotifyMeModal } from '@/components/product/NotifyMeModal'
import { ProductBreadcrumb } from '@/components/product/ProductBreadcrumb'
import { ProductFeatureStrip } from '@/components/product/ProductFeatureStrip'
import { ProductMediaGallery } from '@/components/product/ProductMediaGallery'
import { ProductRatingRow } from '@/components/product/ProductRatingRow'
import { ProductStorySection } from '@/components/product/ProductStorySection'
import { PurchaseOfferBanner } from '@/components/product/PurchaseOfferBanner'
import { RelatedProducts } from '@/components/product/RelatedProducts'
import { SizeGuideModal } from '@/components/product/SizeGuideModal'
import { ReviewFormModal } from '@/components/reviews/ReviewFormModal'
import { ReviewsSection } from '@/components/reviews/ReviewsSection'
import { WishlistHeartButton } from '@/components/wishlist/WishlistHeartButton'
import { useAuth } from '@/context/AuthProvider'
import { useCart } from '@/context/CartProvider'
import { useToast } from '@/context/ToastProvider'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { buyNowCheckoutPath, saveBuyNowIntent } from '@/lib/buyNow'
import { formatInr } from '@/lib/format'
import { buildHighlightChecklist, buildProductFeatures, findFitHighlight } from '@/lib/productFeatures'
import { mapProductDetail } from '@/mappers/productDetailMapper'
import type { Product } from '@/types'
import type { ProductDetailDto, ProductRatingSummaryDto } from '@/types/api/ProductDetailDto'

/**
 * Product detail page.
 *
 * Rebuilt around the fields the backend added for the redesign — rating summary, recent
 * purchase count, quantity discount tiers, a real size chart, and video in the gallery —
 * while keeping every behaviour the previous page already had: the `?sku=` colour
 * contract, the Notify Me flow for sold-out sizes, the low-stock warning, sharing, and
 * add-to-cart.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * ADD TO CART vs BUY NOW
 * ──────────────────────────────────────────────────────────────────────────────
 * These are genuinely different flows and are deliberately not collapsed into one.
 * Add to Cart posts to the cart and the shopper carries on browsing. Buy Now does NOT
 * touch the cart at all: it hands the selected `variant_size_id` and quantity to the
 * checkout, which sends them on to the order endpoints so the order contains only that
 * item. Someone with a full cart tapping Buy Now gets one item, not thirteen.
 */

/**
 * A configured size is buyable only when the backend both lists it in stock and has
 * quantity for it. A configured size with `stock_quantity: 0` stays visible and becomes
 * the Notify Me path — it is out of stock, not non-existent.
 */
function isSizeAvailable(sz: { in_stock: boolean; stock_quantity: number }): boolean {
  return sz.in_stock !== false && sz.stock_quantity > 0
}

/**
 * At or below this many units left, the selected size shows a red "N left" warning.
 * Above it nothing is shown — a running count on every size reads as inventory data
 * rather than scarcity, and stops meaning anything when it matters.
 */
const LOW_STOCK_THRESHOLD = 3

const PLACEHOLDER = '/images/no-image.png'

function WhatsAppIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.39 1.26 4.81L2 22l5.42-1.34a9.9 9.9 0 004.62 1.14h.01c5.46 0 9.9-4.45 9.9-9.9C21.96 6.45 17.5 2 12.04 2zm0 18.02h-.01a8.2 8.2 0 01-4.13-1.13l-.3-.17-3.05.76.82-2.97-.2-.31a8.13 8.13 0 01-1.25-4.29c0-4.5 3.66-8.16 8.15-8.16 2.18 0 4.22.85 5.76 2.39a8.1 8.1 0 012.39 5.77c0 4.5-3.66 8.15-8.18 8.15zm4.47-6.1c-.24-.12-1.45-.71-1.68-.8-.22-.08-.39-.12-.55.12-.16.24-.63.8-.78.96-.14.16-.28.18-.53.06-.24-.12-1.03-.38-1.97-1.21-.73-.65-1.22-1.45-1.36-1.7-.14-.24-.02-.37.11-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.55-1.32-.75-1.8-.2-.48-.4-.42-.55-.42h-.47c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.32.98 2.48c.12.16 1.7 2.6 4.12 3.64.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.45-.59 1.65-1.16.2-.57.2-1.06.14-1.16-.06-.1-.22-.16-.46-.28z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13.5 21v-7.5h2.5l.5-3h-3V8.5c0-.9.25-1.5 1.53-1.5H16.5V4.3C16.2 4.26 15.2 4.17 14 4.17c-2.4 0-4 1.46-4 4.15V10.5H7.5v3H10V21h3.5z" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2H21.5l-7.5 8.57L22.9 22h-6.86l-5.37-6.63L4.5 22H1.24l8.02-9.17L1.1 2h7.03l4.86 6.06L18.244 2z" />
    </svg>
  )
}

function InstagramIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function IconBag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path d="M6 8h12l-1 12H7L6 8z" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M9.5 8V6.5a2.5 2.5 0 015 0V8" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  )
}

function IconBolt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M13.5 2L5 13h5.2l-1 9L19 11h-5.3l.8-9z" />
    </svg>
  )
}

export function ProductDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  const { isAuthenticated } = useAuth()
  const { refreshCart } = useCart()
  const { showToast } = useToast()

  const [product, setProduct] = useState<Product | null>(null)
  const [productDto, setProductDto] = useState<ProductDetailDto | null>(null)

  const [size, setSize] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [adding, setAdding] = useState(false)
  const [buying, setBuying] = useState(false)
  const [justAdded, setJustAdded] = useState(false)

  const [sizeGuideOpen, setSizeGuideOpen] = useState(false)
  const [notifyMeOpen, setNotifyMeOpen] = useState(false)
  const [notifyMePreselect, setNotifyMePreselect] = useState<string | undefined>(undefined)
  const [shareCopied, setShareCopied] = useState(false)

  /**
   * The review form, opened either by "Add Review" or by Edit on the shopper's own card.
   *
   * One piece of state for both, because it is the same form — the only difference is
   * whether it opens on an `order_item_id` or an existing `review_id`.
   */
  const [reviewForm, setReviewForm] = useState<
    | {
        target: { mode: 'create'; orderItemId: number } | { mode: 'edit'; reviewId: number }
        size: string | null
        color: string | null
      }
    | null
  >(null)
  /** True while the eligibility lookup behind "Add Review" is in flight. */
  const [checkingEligibility, setCheckingEligibility] = useState(false)
  /** Bumped to force the reviews block to re-read after a write, edit or delete. */
  const [reviewsToken, setReviewsToken] = useState(0)

  /**
   * The rating row's figures.
   *
   * Seeded from the product response and then kept in step with whatever the reviews
   * block last read, so editing or deleting your own review updates the stars at the top
   * of the page without a second product fetch.
   */
  const [ratingSummary, setRatingSummary] = useState<ProductRatingSummaryDto | null>(null)

  const reviewsRef = useRef<HTMLElement | null>(null)

  const variants = productDto?.variants ?? []
  const skuParam = searchParams.get('sku')

  // `findIndex` returns -1 when there is no explicit default, which `Math.max` folds to 0.
  const defaultVariantIndex = Math.max(variants.findIndex((v) => v.is_default), 0)
  const skuVariantIndex = skuParam ? variants.findIndex((v) => v.sku === skuParam) : -1
  const selectedVariantIndex = skuVariantIndex >= 0 ? skuVariantIndex : defaultVariantIndex

  const currentVariant = variants[selectedVariantIndex]
  const selectedVariantSize = currentVariant?.sizes.find((s) => s.size === size)
  const selectedVariantSizeId = selectedVariantSize?.id ?? null

  useEffect(() => {
    if (!id) return

    let cancelled = false

    async function loadProduct() {
      try {
        const dto = await getProductById(id ?? '')
        if (cancelled) return

        setProductDto(dto)
        setProduct(mapProductDetail(dto))
        setRatingSummary(dto.rating_summary ?? null)
        setQuantity(1)

        window.scrollTo({ top: 0, behavior: 'smooth' })
      } catch {
        navigate('/shop', { replace: true })
      }
    }

    void loadProduct()

    return () => {
      cancelled = true
    }
  }, [id, navigate])

  /*
   * Keep the URL naming the colour actually on screen: `/product/2` becomes
   * `/product/2?sku=B-D2G` as soon as the product loads, and a `sku` this product does not
   * have is corrected to the resolved one. So every PDP URL is shareable as-is, with no
   * "whatever the default happens to be today" case.
   *
   * `replace` because this is the same page, not a new destination — pushing would put a
   * param-less copy of this URL behind the shopper, so Back would appear to do nothing.
   * The write is skipped once the param already matches, which is what stops it looping.
   */
  useEffect(() => {
    if (!currentVariant) return
    if (skuParam === currentVariant.sku) return

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('sku', currentVariant.sku)
        return next
      },
      { replace: true },
    )
  }, [currentVariant, skuParam, setSearchParams])

  /*
   * The first in-stock size of whichever variant is currently resolved. Derived in one
   * place from the URL-resolved variant, so a refresh — or Back/Forward between two
   * colours — lands on the same size a tap would.
   */
  useEffect(() => {
    if (!currentVariant) {
      setSize('')
      return
    }
    const firstAvailable = currentVariant.sizes.find((s) => s.in_stock)
    setSize(firstAvailable?.size ?? '')
  }, [currentVariant])

  // A different size (or colour — the id covers both) is a different line, so it is
  // offered fresh. Quantity restarts at 1 for the same reason.
  useEffect(() => {
    setQuantity(1)
    setJustAdded(false)
  }, [selectedVariantSizeId])

  useDocumentTitle(product?.name ?? 'Product')

  const handleSummaryLoaded = useCallback((summary: ProductRatingSummaryDto) => {
    setRatingSummary((current) => {
      // Reference-stable when nothing moved, so this cannot loop with the reviews block.
      if (
        current &&
        current.average_rating === summary.average_rating &&
        current.total_reviews === summary.total_reviews &&
        current.recommend_percentage === summary.recommend_percentage
      ) {
        return current
      }
      return {
        average_rating: summary.average_rating,
        total_reviews: summary.total_reviews,
        recommend_percentage: summary.recommend_percentage,
      }
    })
  }, [])

  const requireSignIn = () => {
    navigate('/login', { state: { from: `${location.pathname}${location.search}` } })
  }

  /**
   * "Add Review".
   *
   * A review attaches to a DELIVERED order item, not to a product, so this button has no
   * `order_item_id` of its own — it has to find one. `resolveReviewEligibility` scans the
   * customer's orders and answers with the item to review, the review they already wrote,
   * or the reason there is neither.
   *
   * Opening the form regardless would be simpler and wrong: the backend answers 403 for
   * anyone who has not received the product, and a form that fails on submit reads as a
   * bug rather than as a rule. So a customer who has not bought it is told plainly, at the
   * moment they ask, instead of after filling the form in.
   */
  const handleWriteReview = async () => {
    if (!productDto || checkingEligibility) return

    if (!isAuthenticated) {
      requireSignIn()
      return
    }

    setCheckingEligibility(true)
    try {
      const eligibility = await resolveReviewEligibility(productDto.id)

      switch (eligibility.status) {
        case 'eligible':
          setReviewForm({
            target: { mode: 'create', orderItemId: eligibility.orderItemId },
            size: eligibility.size,
            color: eligibility.color,
          })
          return

        case 'already-reviewed':
          // Not an error: they have reviewed it, so the useful action is editing.
          setReviewForm({
            target: { mode: 'edit', reviewId: eligibility.reviewId },
            size: eligibility.size,
            color: eligibility.color,
          })
          return

        case 'not-purchased':
          showToast('Reviews are for verified buyers', {
            variant: 'warning',
            description: 'You can review this product once your order has been delivered.',
            duration: 5000,
          })
          return

        default:
          showToast('Could not open the review form', {
            variant: 'warning',
            description: eligibility.message,
          })
      }
    } finally {
      setCheckingEligibility(false)
    }
  }

  const handleAddToCart = async () => {
    if (!product || !selectedVariantSizeId || adding) return

    if (!isAuthenticated) {
      requireSignIn()
      return
    }

    setAdding(true)
    try {
      /*
       * Re-adding the same size is intentional and additive: the backend documents this
       * POST as "Adds a specific variant size product to the user's cart. If it already
       * exists, increments quantity." So a second add raises the line's quantity and the
       * cart badge rather than erroring or overwriting — no client-side merging needed.
       */
      await addToCart(selectedVariantSizeId, quantity)
      await refreshCart()
      setJustAdded(true)
      showToast('Added to cart', { description: 'Product added successfully' })
    } catch (error) {
      console.error('Failed to add product to cart', error)
      showToast('Could not add to cart', { variant: 'warning', description: 'Please try again.' })
    } finally {
      setAdding(false)
    }
  }

  /** One control, two steps: add the item, then take the shopper to the cart. */
  const handlePrimaryAction = () => {
    if (justAdded) {
      navigate('/cart')
      return
    }
    void handleAddToCart()
  }

  /**
   * Buy Now — straight to checkout with this one item.
   *
   * Nothing is posted here and the cart is not touched. The intent is stashed where it
   * survives the sign-in detour a guest has to take, and the checkout reads it from there.
   */
  const handleBuyNow = () => {
    if (!product || !productDto || !currentVariant || !selectedVariantSizeId || buying) return

    setBuying(true)

    saveBuyNowIntent({
      variantSizeId: selectedVariantSizeId,
      quantity,
      productId: productDto.id,
      name: product.name,
      image: currentVariant.images?.find((img) => img.media_type !== 'VIDEO')?.image_url?.trim() || PLACEHOLDER,
      color: currentVariant.color,
      size,
      unitPrice: currentVariant.selling_price,
      mrp: currentVariant.mrp,
      tiers: productDto.quantity_discount_tiers ?? [],
    })

    if (!isAuthenticated) {
      // Returns to the Buy Now checkout, not to this page — the intent is already saved.
      navigate('/login', { state: { from: buyNowCheckoutPath() } })
      setBuying(false)
      return
    }

    navigate(buyNowCheckoutPath())
  }

  const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
  const shareTitle = product?.name ?? 'Panchvastra'

  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareTitle} ${shareUrl}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`,
  }

  // Instagram has no browser URL-share endpoint for arbitrary links. On devices that
  // support the Web Share API, the OS share sheet (which can include Instagram) is used —
  // a genuinely real flow. Otherwise the link is copied so it can be pasted in manually,
  // rather than pretending a direct share happened.
  const handleInstagramShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl })
      } catch {
        // User cancelled the native share sheet — nothing to do.
      }
      return
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    } catch {
      // Clipboard unavailable — silently ignore.
    }
  }

  if (!product || !productDto) {
    return <div className="p-16 text-center font-sans text-zinc-500">Loading…</div>
  }

  const productSizes = currentVariant?.sizes ?? []
  const allSizesOutOfStock = productSizes.length > 0 && !productSizes.some(isSizeAvailable)

  /** Units left for the selected size, but only while that count is 3, 2 or 1. */
  const lowStockRemaining =
    selectedVariantSize &&
    selectedVariantSize.in_stock &&
    selectedVariantSize.stock_quantity > 0 &&
    selectedVariantSize.stock_quantity <= LOW_STOCK_THRESHOLD
      ? selectedVariantSize.stock_quantity
      : null

  const maxQty = selectedVariantSize ? Math.max(1, Math.min(selectedVariantSize.stock_quantity, 10)) : 1
  const canAdd = Boolean(selectedVariantSizeId) && !adding
  const canBuyNow = Boolean(selectedVariantSizeId) && !buying && !allSizesOutOfStock

  /*
   * Sizes are rendered in the ORDER THE BACKEND SENT THEM and are not re-sorted.
   * The contract states they already arrive S, M, L, XL, XXL…; re-sorting against a
   * hardcoded run would silently drop any size outside it to the end, and would fight the
   * backend the day a category uses a different scale (28/30/32, say).
   */
  const uiSizes = productSizes.map((apiSize) => ({
    size: apiSize.size,
    id: apiSize.id,
    inStock: isSizeAvailable(apiSize),
    stockQuantity: apiSize.stock_quantity,
  }))

  // Single source of truth for the Notify Me modal too. Every entry here is a real
  // configured size carrying its backend `variant_size_id`, so a restock notification can
  // only ever be requested for a size the product actually comes in.
  const unavailableSizes = uiSizes.filter((sz) => !sz.inStock).map((sz) => ({ size: sz.size, variantSizeId: sz.id }))

  const sizeChart = productDto.size_chart ?? null
  const features = buildProductFeatures(productDto.key_highlights, productDto.gsm, productDto.fabric)
  const fitHighlight = findFitHighlight(productDto.key_highlights)
  const checklist = buildHighlightChecklist(productDto.key_highlights)

  const sellingPrice = currentVariant?.selling_price ?? product.price
  const mrp = currentVariant?.mrp ?? product.compareAtPrice ?? 0
  const discountPercentage = currentVariant?.discount_percentage ?? product.salePct ?? 0
  const hasDiscount = discountPercentage > 0 && mrp > sellingPrice

  const subCategoryName = productDto.sub_category?.name ?? productDto.sub_category_name ?? null

  /* The story image is the SECOND gallery image — the first is the hero already above. */
  const galleryImages = currentVariant?.images?.filter((img) => img.media_type !== 'VIDEO') ?? []
  const storyImage = (galleryImages[1] ?? galleryImages[0])?.image_url?.trim() || null

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 lg:px-8 lg:py-8">
      <ProductBreadcrumb
        categoryName={productDto.category?.name}
        subCategoryName={subCategoryName}
        productName={product.name}
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,52fr)_minmax(0,48fr)] lg:gap-12">
        <div className="lg:sticky lg:top-24 lg:h-fit">
          {/* `key` remounts the gallery per colour, which structurally stops a playing
              video from continuing under the next variant's images. */}
          <ProductMediaGallery
            key={currentVariant?.id ?? selectedVariantIndex}
            images={currentVariant?.images}
            fallbackUrls={product.images}
            productName={product.name}
          />
        </div>

        {/*
          `min-w-0` because this is a grid item, and a grid item's default `min-width: auto`
          lets its widest content set its size — the colour row was doing exactly that and
          pushing the page sideways on a 375px screen.
        */}
        <div className="flex min-w-0 flex-col gap-6">
          <div>
            {/* The eyebrow trails off into a hairline, as in the design. The rule is
                decorative and `aria-hidden`, so the label reads cleanly to a screen reader. */}
            {subCategoryName ? (
              <p className="flex items-center gap-3">
                <span className="type-eyebrow shrink-0">{subCategoryName} Series</span>
                <span aria-hidden className="h-px min-w-6 flex-1 bg-sand" />
              </p>
            ) : null}

            <h1 className="type-product-detail-title mt-1.5">{product.name}</h1>

            <p className="mt-1 font-sans text-sm text-zinc-500">
              {[productDto.category?.name, subCategoryName].filter(Boolean).join(' • ')}
            </p>

            <ProductRatingRow
              summary={ratingSummary}
              onReviewsClick={() => reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="type-price-lg">{formatInr(sellingPrice)}</span>

              {/* MRP and the badge are hidden together when there is no discount — a
                  struck-through price equal to the selling price is just noise. */}
              {hasDiscount ? (
                <>
                  <span className="text-lg text-zinc-400 line-through">{formatInr(mrp)}</span>
                  <span className="rounded-full bg-burgundy px-3 py-1 font-sans text-xs font-bold uppercase tracking-wide text-cream">
                    {Math.round(discountPercentage)}% OFF
                  </span>
                </>
              ) : null}
            </div>

            <p className="mt-1 font-sans text-xs text-zinc-500">Inclusive of all taxes</p>

            <PurchaseOfferBanner
              recentPurchaseCount={productDto.recent_purchase_count}
              tiers={productDto.quantity_discount_tiers}
            />
          </div>

          <ColorSwatchPicker
            variants={variants}
            currentIndex={selectedVariantIndex}
            onSelect={(index) => {
              const variant = variants[index]
              if (!variant) return

              /*
               * `replace` so a run of colour taps does not bury the page the shopper came
               * from under one history entry per colour — Back still returns to the
               * listing. Any other param is carried over rather than dropped.
               */
              setSearchParams(
                (prev) => {
                  const next = new URLSearchParams(prev)
                  next.set('sku', variant.sku)
                  return next
                },
                { replace: true },
              )
            }}
          />

          <div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="font-sans text-sm font-semibold text-black">Select Size</p>

              {/* Rendered only when this product's category actually has a chart. */}
              {sizeChart ? (
                <button
                  type="button"
                  onClick={() => setSizeGuideOpen(true)}
                  className="inline-flex min-h-[32px] items-center gap-1.5 font-sans text-xs font-semibold text-zinc-600 underline underline-offset-2 transition-colors hover:text-black"
                >
                  <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                    <path d="M20.5 3.5L9 15l-2.6 2.6M20.5 3.5l-1.2 4.2-3-3 4.2-1.2z" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M3 21c1.4-.5 2.6-1.4 3.4-2.4" strokeWidth={1.5} strokeLinecap="round" />
                  </svg>
                  Size Guide
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2.5">
              {uiSizes.map((sz) => (
                <button
                  key={`${sz.id}-${sz.size}`}
                  type="button"
                  aria-disabled={!sz.inStock}
                  aria-pressed={sz.size === size}
                  onClick={() => {
                    if (sz.inStock) {
                      setSize(sz.size)
                    } else if (unavailableSizes.length > 0) {
                      // Only open Notify Me when something is actually subscribable —
                      // otherwise the modal would contradict the crossed-out size shown here.
                      setNotifyMePreselect(sz.size)
                      setNotifyMeOpen(true)
                    }
                  }}
                  className={`relative flex h-11 min-w-[56px] items-center justify-center overflow-hidden rounded-lg border px-3 font-sans text-sm font-semibold transition-all ${
                    sz.size === size
                      ? 'border-chocolate bg-chocolate text-cream'
                      : sz.inStock
                        ? 'border-zinc-300 text-zinc-800 hover:border-chocolate'
                        : 'border-zinc-200 text-zinc-400'
                  }`}
                >
                  {sz.size}
                  {!sz.inStock ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] bg-zinc-300"
                    />
                  ) : null}
                </button>
              ))}
            </div>

            {/* "Oversized Fit | Relaxed and comfortable silhouette" — the one highlight
                that belongs here, at the moment the shopper is choosing a size. */}
            {fitHighlight ? (
              <p className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 font-sans text-xs text-zinc-600">
                <svg className="size-4 shrink-0 text-espresso" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                  <path d="M12 3.5l8.5 4-8.5 4-8.5-4 8.5-4z" strokeWidth={1.4} strokeLinejoin="round" />
                  <path d="M3.5 12l8.5 4 8.5-4" strokeWidth={1.4} strokeLinejoin="round" />
                </svg>
                <span className="font-semibold text-black">{fitHighlight.label}</span>
                <span aria-hidden className="text-zinc-300">|</span>
                <span>{fitHighlight.value}</span>
              </p>
            ) : null}

            {/*
              Low-stock warning for the SELECTED size only, and only once it is genuinely
              scarce — 3, 2 or 1 remaining. Below that bar it is urgency the shopper can
              act on; above it ("8 left") it is just inventory noise on every size.
            */}
            {lowStockRemaining !== null ? (
              <p className="mt-3 font-sans text-xs font-semibold uppercase tracking-wide text-burgundy">
                Only {lowStockRemaining} left
              </p>
            ) : null}

            {/* Shown only when there is a size the shopper can actually subscribe to, so
                the row never appears alongside a modal with nothing to offer. */}
            {unavailableSizes.length > 0 ? (
              <div className="mt-3 flex items-center justify-between gap-4">
                <p className="font-sans text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Size not available?
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setNotifyMePreselect(undefined)
                    setNotifyMeOpen(true)
                  }}
                  className="inline-flex min-h-[32px] items-center font-sans text-xs font-semibold uppercase tracking-wide text-black underline underline-offset-2"
                >
                  Notify Me
                </button>
              </div>
            ) : null}
          </div>

          {/*
            The quantity stepper is NOT in the redesign, and is kept anyway: both Add to
            Cart and Buy Now take a quantity, and dropping the control would silently
            reduce every purchase to one unit. It is styled down to a compact inline row so
            it sits under the design rather than competing with it.
          */}
          {!allSizesOutOfStock ? (
            <div className="flex items-center gap-3">
              <p className="font-sans text-sm font-semibold text-black">Quantity</p>
              <div className="inline-flex items-center rounded-lg border border-zinc-300">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1 || justAdded}
                  aria-label="Decrease quantity"
                  className="flex size-9 items-center justify-center text-lg font-semibold text-black transition disabled:opacity-30"
                >
                  −
                </button>
                <span aria-live="polite" className="w-8 text-center font-sans text-sm font-semibold text-black">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty || justAdded}
                  aria-label="Increase quantity"
                  className="flex size-9 items-center justify-center text-lg font-semibold text-black transition disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handlePrimaryAction}
                // Stays ENABLED after a successful add — it becomes the route to the cart
                // rather than a dead "Added to cart" label.
                disabled={!canAdd}
                aria-busy={adding}
                className="type-btn flex flex-1 items-center justify-center gap-2 rounded-lg border border-chocolate bg-chocolate px-4 py-3.5 text-sm text-cream transition hover:bg-espresso disabled:opacity-50"
              >
                <IconBag className="size-4" />
                {adding ? 'ADDING…' : justAdded ? 'GO TO CART' : 'ADD TO CART'}
              </button>

              <button
                type="button"
                onClick={handleBuyNow}
                disabled={!canBuyNow}
                aria-busy={buying}
                className="type-btn flex flex-1 items-center justify-center gap-2 rounded-lg border border-burgundy bg-burgundy px-4 py-3.5 text-sm text-cream transition hover:opacity-90 disabled:opacity-50"
              >
                <IconBolt className="size-4" />
                {buying ? 'STARTING…' : 'BUY NOW'}
              </button>

              <WishlistHeartButton productId={productDto.id} variant="pdp" />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-sans text-xs font-semibold uppercase tracking-wide text-zinc-600">Share</span>
              <a
                href={shareLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on WhatsApp"
                className="flex size-8 items-center justify-center rounded-full border border-zinc-300 text-black transition-colors hover:border-black"
              >
                <WhatsAppIcon />
              </a>
              <a
                href={shareLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on Facebook"
                className="flex size-8 items-center justify-center rounded-full border border-zinc-300 text-black transition-colors hover:border-black"
              >
                <FacebookIcon />
              </a>
              <a
                href={shareLinks.x}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on X"
                className="flex size-8 items-center justify-center rounded-full border border-zinc-300 text-black transition-colors hover:border-black"
              >
                <XIcon />
              </a>
              <button
                type="button"
                onClick={handleInstagramShare}
                aria-label="Share on Instagram"
                className="flex size-8 items-center justify-center rounded-full border border-zinc-300 text-black transition-colors hover:border-black"
              >
                <InstagramIcon />
              </button>
              {shareCopied ? <span className="font-sans text-xs text-zinc-500">Link copied</span> : null}
            </div>
          </div>
        </div>
      </div>

      <ProductFeatureStrip features={features} />

      <ProductStorySection
        description={productDto.description}
        highlights={checklist}
        imageUrl={storyImage}
        productName={product.name}
      />

      <ReviewsSection
        ref={reviewsRef}
        productId={productDto.id}
        refreshToken={reviewsToken}
        onEditReview={(review) =>
          setReviewForm({
            target: { mode: 'edit', reviewId: review.id },
            size: review.size,
            color: review.color,
          })
        }
        onSummaryLoaded={handleSummaryLoaded}
        onWriteReview={() => void handleWriteReview()}
        writeReviewBusy={checkingEligibility}
      />

      <RelatedProducts productId={productDto.id} />

      {sizeChart ? (
        <SizeGuideModal isOpen={sizeGuideOpen} onClose={() => setSizeGuideOpen(false)} chart={sizeChart} />
      ) : null}

      <NotifyMeModal
        isOpen={notifyMeOpen}
        unavailableSizes={unavailableSizes}
        preselectedSize={notifyMePreselect}
        onClose={() => setNotifyMeOpen(false)}
      />

      {reviewForm ? (
        <ReviewFormModal
          target={reviewForm.target}
          context={{
            productName: product.name,
            size: reviewForm.size,
            color: reviewForm.color,
          }}
          onClose={() => setReviewForm(null)}
          // Re-reads the list and the summary, so the new rating is reflected in the stars
          // at the top of the page without a second product fetch.
          onSaved={() => setReviewsToken((token) => token + 1)}
        />
      ) : null}
    </div>
  )
}
