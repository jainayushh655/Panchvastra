import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { KeyHighlightsSection } from '@/components/product/KeyHighlightsSection'
import { ProductDetailAccordions } from '@/components/product/ProductDetailAccordions'
import { ProductImageGallery } from '@/components/product/ProductImageGallery'
import { ProductVariantPicker } from '@/components/product/ProductVariantPicker'
import { useCart } from '@/context/CartProvider'
import { getProductById } from '@/api/product'
import { mapProductDetail, } from '@/mappers/productDetailMapper'
import { formatInr } from '@/lib/format'
import type { Product } from '@/types'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import type { ProductDetailDto } from '@/types/api/ProductDetailDto'
import { addToCart } from '@/api/cart'
import { useAuth } from '@/context/AuthProvider'

export function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { refreshCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [productDto, setProductDto] =
    useState<ProductDetailDto | null>(null);

  const [selectedVariantIndex, setSelectedVariantIndex] =
    useState(0);

  const [size, setSize] = useState("");

  const [showCartPopup, setShowCartPopup] =
    useState(false);

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
    await addToCart(selectedVariantSizeId, 1);
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

  if (!product) {
    return <div className="p-16 text-center font-sans text-zinc-500">Loading…</div>
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <ProductImageGallery
          images={
            currentVariant?.images.map((img) =>
              img.image_url?.trim() ? img.image_url : "/images/no-image.png"
            ) ?? product.images
          }
        />

        <div className="sticky top-24 h-fit">
          <h1 className="type-product-detail-title">{product.name}</h1>

          <div className="mt-6 flex flex-wrap items-center gap-2">

            <span className="type-price-lg">
              {formatInr(currentVariant?.selling_price ?? product.price)}
            </span>

            {(currentVariant?.mrp ?? product.compareAtPrice ?? 0) >
              (currentVariant?.selling_price ?? product.price) && (
                <>
                  <span className="text-lg text-zinc-400 line-through">
                    {formatInr(currentVariant?.mrp ?? product.compareAtPrice ?? 0)}
                  </span>

                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 font-sans text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {currentVariant?.discount_percentage ?? product.salePct ?? 0}% OFF
                  </span>
                </>
              )}

          </div>

          <div className="my-6 border-t border-zinc-200 dark:border-zinc-800" />

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

          <div className={hasVariantPicker ? 'mt-8' : ''}>
            <p className="font-sans text-sm font-semibold text-zinc-900 dark:text-white">Select Size</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {currentVariant?.sizes.map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  disabled={!sz.in_stock}
                  onClick={() => setSize(sz.size)}
                  className={`flex h-12 min-w-[52px] items-center justify-center rounded-xl border font-sans text-sm font-semibold transition-all ${sz.size === size
                      ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
                      : "border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
                    } ${!sz.in_stock ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  {sz.size}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-4 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
            <p>
              <strong>Selected Color:</strong>{" "}
              {currentVariant?.color}
            </p>

            <p>
              <strong>Variant ID:</strong>{" "}
              {currentVariant?.id}
            </p>

            <p>
              <strong>Variant Size ID:</strong>{" "}
              {selectedVariantSizeId}
            </p>
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
