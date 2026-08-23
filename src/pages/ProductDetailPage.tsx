import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { KeyHighlightsSection } from '@/components/product/KeyHighlightsSection'
import { NotifyMeModal } from '@/components/product/NotifyMeModal'
import { ProductDetailAccordions } from '@/components/product/ProductDetailAccordions'
import { ProductImageGallery } from '@/components/product/ProductImageGallery'
import { ProductVariantPicker } from '@/components/product/ProductVariantPicker'
import { SizeChart } from '@/components/product/SizeChart'
import { useCart } from '@/context/CartProvider'
import { useWishlist, type WishlistItem } from '@/context/WishlistProvider'
import { getProductById } from '@/api/product'
import { mapProductDetail, } from '@/mappers/productDetailMapper'
import { formatInr } from '@/lib/format'
import type { Product } from '@/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import type { ProductDetailDto } from '@/types/api/ProductDetailDto'
import { addToCart } from '@/api/cart'
import { useAuth } from '@/context/AuthProvider'

/** Standard apparel size run, always shown in this fixed order regardless of what the API returns. */
const UI_SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'] as const

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="size-5"
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 20.25s-7.5-4.6-9.75-9.1C.75 7.6 2.6 4.5 6 4.5c2 0 3.5 1 6 3.3 2.5-2.3 4-3.3 6-3.3 3.4 0 5.25 3.1 3.75 6.65-2.25 4.5-9.75 9.1-9.75 9.1z"
      />
    </svg>
  )
}

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
      <path d="M18.244 2H21.5l-7.5 8.57L22.9 22h-6.86l-5.37-6.63L4.5 22H1.24l8.02-9.17L1.1 2h7.03l4.86 6.06L18.244 2zm-1.2 18h1.9L7.02 4h-2l12.02 16z" />
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

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { refreshCart } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const [product, setProduct] = useState<Product | null>(null);
  const [productDto, setProductDto] =
    useState<ProductDetailDto | null>(null);

  const [selectedVariantIndex, setSelectedVariantIndex] =
    useState(0);

  const [size, setSize] = useState("");

  const [quantity, setQuantity] = useState(1);

  const [showCartPopup, setShowCartPopup] =
    useState(false);

  const [sizeChartOpen, setSizeChartOpen] = useState(false);

  const [notifyMeOpen, setNotifyMeOpen] = useState(false);
  const [notifyMePreselect, setNotifyMePreselect] = useState<string | undefined>(undefined);

  const [shareCopied, setShareCopied] = useState(false);

  const currentVariant =
    productDto?.variants[selectedVariantIndex];

  const selectedVariantSize =
    currentVariant?.sizes.find(
      (s) => s.size === size
    );

  const selectedVariantSizeId =
    selectedVariantSize?.id ?? null;

  const hasVariantPicker =
    (productDto?.variants.length ?? 0) > 1;

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    async function loadProduct() {
      try {
        const dto = await getProductById(id ?? '');

        if (cancelled) return;

        setProductDto(dto);

        const defaultIndex =
          dto.variants.findIndex((v) => v.is_default);

        const variantIndex =
          defaultIndex >= 0 ? defaultIndex : 0;

        setSelectedVariantIndex(variantIndex);

        const mapped =
          mapProductDetail(dto);

        setProduct(mapped);

        const defaultVariant =
          dto.variants[variantIndex];

        const defaultSize =
          defaultVariant.sizes.find(
            (s) => s.in_stock
          );

        setSize(defaultSize?.size ?? "");
        setQuantity(1);

        window.scrollTo({
          top: 0,
          behavior: "smooth",
        });

      } catch {
        navigate("/shop", {
          replace: true,
        });
      }
    }

    loadProduct();

    return () => {
      cancelled = true;
    };

  }, [id, navigate]);

  useDocumentTitle(
    product?.name ?? "Product"
  );
  useDocumentTitle(product?.name ?? 'Product')

  // Keep quantity within the real stock available for whichever size is selected.
  useEffect(() => {
    setQuantity(1);
  }, [selectedVariantSizeId]);

  const canAdd =
    Boolean(product) &&
    Boolean(selectedVariantSizeId);

  const add = async () => {
  if (!product || !selectedVariantSizeId) return;

  if (!isAuthenticated) {
    navigate('/login', { replace: false, state: { from: `${location.pathname}${location.search}` } })
    return
  }

  try {
    await addToCart(selectedVariantSizeId, quantity);
    await refreshCart();
  } catch (error) {
    console.error("Failed to add product to cart", error);
  }
};

  const handleAddToCart = async () => {
  await add();

  if (!isAuthenticated) {
    return
  }

  setShowCartPopup(true);

  setTimeout(() => {
    setShowCartPopup(false);
  }, 2500);
};

  const handleWishlistToggle = () => {
    if (!product) return;

    if (!isAuthenticated) {
      navigate('/login', { replace: false, state: { from: `${location.pathname}${location.search}` } })
      return
    }

    const item: WishlistItem = {
      id: product.id,
      name: product.name,
      image: currentVariant?.images[0]?.image_url?.trim() || product.images[0] || '/images/no-image.png',
      price: currentVariant?.selling_price ?? product.price,
      compareAtPrice: currentVariant?.mrp ?? product.compareAtPrice ?? null,
    };

    toggleWishlist(item);
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = product?.name ?? 'Panchvastra';

  const shareLinks = {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareTitle} ${shareUrl}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
    x: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareTitle)}&url=${encodeURIComponent(shareUrl)}`,
  };

  // Instagram has no browser URL-share endpoint for arbitrary links. On devices that support
  // the Web Share API, the OS-level share sheet (which can include Instagram) is used —  a
  // genuinely real flow. Otherwise, the link is copied so it can be pasted into Instagram
  // manually, rather than pretending a direct share happened.
  const handleInstagramShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, url: shareUrl });
      } catch {
        // User cancelled the native share sheet — nothing to do.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      // Clipboard unavailable — silently ignore.
    }
  };

  if (!product) {
    return <div className="p-16 text-center font-sans text-zinc-500">Loading…</div>
  }

  const productSizes = currentVariant?.sizes ?? [];
  const allSizesOutOfStock = productSizes.length > 0 && productSizes.every((sz) => !sz.in_stock);
  const wishlisted = isWishlisted(product.id);
  const maxQty = selectedVariantSize ? Math.max(1, Math.min(selectedVariantSize.stock_quantity, 10)) : 1;
  const subtitle = [productDto?.category?.name, productDto?.sub_category?.name].filter(Boolean).join(' · ');

  // Always render the full standard size run; availability for each comes from the real
  // per-variant API data (a size absent from the API response is treated as unavailable,
  // same as one explicitly marked `in_stock: false`).
  const uiSizes = UI_SIZE_OPTIONS.map((label) => {
    const apiSize = productSizes.find((sz) => sz.size === label);
    return {
      size: label,
      id: apiSize?.id ?? null,
      inStock: apiSize?.in_stock ?? false,
      stockQuantity: apiSize?.stock_quantity ?? 0,
    };
  });
  // Single source of truth for the Notify Me modal too — it only ever sees sizes derived here.
  const unavailableSizes = uiSizes.filter((sz) => !sz.inStock).map((sz) => sz.size);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[55fr_45fr] lg:gap-12">
        <div className="lg:sticky lg:top-24 lg:h-fit">
          <ProductImageGallery
            key={selectedVariantIndex}
            images={
              currentVariant?.images.map((img) =>
                img.image_url?.trim() ? img.image_url : "/images/no-image.png"
              ) ?? product.images
            }
          />
        </div>

        <div className="flex max-w-xl flex-col gap-7">
          <div>
            <h1 className="type-product-detail-title">{product.name}</h1>
            {subtitle ? <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{subtitle}</p> : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">

              <span className="type-price-lg">
                {formatInr(currentVariant?.selling_price ?? product.price)}
              </span>

              {(currentVariant?.mrp ?? product.compareAtPrice ?? 0) >
                (currentVariant?.selling_price ?? product.price) && (
                  <>
                    <span className="text-lg text-zinc-400 line-through">
                      {formatInr(currentVariant?.mrp ?? product.compareAtPrice ?? 0)}
                    </span>

                    <span className="rounded-full border border-black px-3 py-1 font-sans text-sm font-semibold text-black">
                      {currentVariant?.discount_percentage ?? product.salePct ?? 0}% OFF
                    </span>
                  </>
                )}

            </div>
          </div>

          <div className="border-t border-zinc-200 dark:border-zinc-800" />

          {hasVariantPicker ? (
            <ProductVariantPicker
              variants={productDto?.variants ?? []}
              currentIndex={selectedVariantIndex}
              onSelect={(index) => {

                setSelectedVariantIndex(index);

                const variant = productDto?.variants[index];

                const firstSize =
                  variant?.sizes.find((s) => s.in_stock);

                setSize(firstSize?.size ?? "");

              }}
            />
          ) : null}

          <div>
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <p className="font-sans text-sm font-semibold text-zinc-900 dark:text-white">Select Size</p>
              <button
                type="button"
                onClick={() => setSizeChartOpen(true)}
                className="font-sans text-xs font-semibold uppercase tracking-wide text-zinc-600 underline underline-offset-2 transition-colors hover:text-black dark:text-zinc-400 dark:hover:text-white"
              >
                Size Chart
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {uiSizes.map((sz) => (
                <button
                  key={sz.size}
                  type="button"
                  aria-disabled={!sz.inStock}
                  onClick={() => {
                    if (sz.inStock) {
                      setSize(sz.size);
                    } else {
                      setNotifyMePreselect(sz.size);
                      setNotifyMeOpen(true);
                    }
                  }}
                  className={`relative flex h-12 min-w-[52px] items-center justify-center overflow-hidden rounded-xl border font-sans text-sm font-semibold transition-all ${sz.size === size
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : sz.inStock
                        ? "border-zinc-300 text-zinc-700 hover:border-black dark:border-zinc-700 dark:text-zinc-200"
                        : "border-zinc-200 text-zinc-400 dark:border-zinc-800 dark:text-zinc-600"
                    }`}
                >
                  {sz.size}
                  {!sz.inStock ? (
                    <span
                      aria-hidden
                      className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[140%] -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] bg-zinc-300 dark:bg-zinc-600"
                    />
                  ) : null}
                </button>
              ))}
            </div>
            {selectedVariantSize && selectedVariantSize.in_stock && selectedVariantSize.stock_quantity > 0 && selectedVariantSize.stock_quantity <= 10 ? (
              <p className="mt-3 font-sans text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                {selectedVariantSize.stock_quantity} left
              </p>
            ) : null}
            <div className="mt-3 flex items-center justify-between gap-4">
              <p className="font-sans text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Size not available?
              </p>
              <button
                type="button"
                onClick={() => {
                  setNotifyMePreselect(undefined);
                  setNotifyMeOpen(true);
                }}
                className="font-sans text-xs font-semibold uppercase tracking-wide text-black underline underline-offset-2 dark:text-white"
              >
                Notify Me
              </button>
            </div>
          </div>

          {!allSizesOutOfStock ? (
            <div>
              <p className="font-sans text-sm font-semibold text-zinc-900 dark:text-white">Quantity</p>
              <div className="mt-3 inline-flex items-center gap-4 border border-zinc-300 px-3 py-2 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                  className="flex size-6 items-center justify-center text-lg font-semibold text-black transition disabled:opacity-30 dark:text-white"
                >
                  −
                </button>
                <span className="w-6 text-center text-sm font-semibold text-black dark:text-white">{quantity}</span>
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty}
                  aria-label="Increase quantity"
                  className="flex size-6 items-center justify-center text-lg font-semibold text-black transition disabled:opacity-30 dark:text-white"
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
                onClick={handleAddToCart}
                disabled={!canAdd}
                className="type-btn flex-1 rounded-xl bg-black px-6 py-4 text-sm text-white transition hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
              >
                ADD TO CART
              </button>
              <button
                type="button"
                onClick={handleWishlistToggle}
                aria-pressed={wishlisted}
                aria-label={wishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
                className={`flex size-[52px] shrink-0 items-center justify-center rounded-xl border transition-colors ${
                  wishlisted
                    ? 'border-black bg-black text-white dark:border-white dark:bg-white dark:text-black'
                    : 'border-zinc-300 text-black hover:border-black dark:border-zinc-700 dark:text-white'
                }`}
              >
                <HeartIcon filled={wishlisted} />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-sans text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
                Share
              </span>
              <a
                href={shareLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on WhatsApp"
                title="Share on WhatsApp"
                className="flex size-8 items-center justify-center rounded-full border border-zinc-300 text-black transition-colors hover:border-black dark:border-zinc-700 dark:text-white"
              >
                <WhatsAppIcon />
              </a>
              <a
                href={shareLinks.facebook}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on Facebook"
                title="Share on Facebook"
                className="flex size-8 items-center justify-center rounded-full border border-zinc-300 text-black transition-colors hover:border-black dark:border-zinc-700 dark:text-white"
              >
                <FacebookIcon />
              </a>
              <a
                href={shareLinks.x}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on X"
                title="Share on X"
                className="flex size-8 items-center justify-center rounded-full border border-zinc-300 text-black transition-colors hover:border-black dark:border-zinc-700 dark:text-white"
              >
                <XIcon />
              </a>
              <button
                type="button"
                onClick={handleInstagramShare}
                aria-label="Share on Instagram"
                title="Share on Instagram"
                className="flex size-8 items-center justify-center rounded-full border border-zinc-300 text-black transition-colors hover:border-black dark:border-zinc-700 dark:text-white"
              >
                <InstagramIcon />
              </button>
              {shareCopied ? (
                <span className="font-sans text-xs text-zinc-500 dark:text-zinc-400">Link copied</span>
              ) : null}
            </div>
          </div>

          <div>
            <KeyHighlightsSection product={product} />
            <ProductDetailAccordions product={product} />
          </div>
        </div>
      </div>

      <SizeChart
        isOpen={sizeChartOpen}
        onClose={() => setSizeChartOpen(false)}
        sizes={[...UI_SIZE_OPTIONS]}
      />

      <NotifyMeModal
        isOpen={notifyMeOpen}
        unavailableSizes={unavailableSizes}
        preselectedSize={notifyMePreselect}
        onClose={() => setNotifyMeOpen(false)}
      />

      {showCartPopup ? (
        <div
          className="fixed top-24 right-6 z-[9999] animate-in slide-in-from-top duration-300"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 rounded-2xl bg-black px-5 py-4 text-white shadow-2xl">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white font-sans text-sm font-bold text-black"
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
