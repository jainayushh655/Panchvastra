import type { Product } from "@/types";
import type { ProductDetailDto } from "@/types/api/ProductDetailDto";
import { readKeyHighlights } from '@/lib/keyHighlights';

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getCategorySlug(category: string): string {
  switch (category.toLowerCase()) {
    case "t-shirts":
      return "regular-tee";

    case "shorts":
      return "shorts";

    default:
      return "regular-tee";
  }
}

function safeImage(url?: string) {
  const trimmed = url?.trim();
  return trimmed ? trimmed : "/images/no-image.png";
}

export function mapProductDetail(dto: ProductDetailDto): Product {
  const defaultVariant =
    dto.variants.find((v) => v.is_default) ?? dto.variants[0];

  const availableSizes = defaultVariant.sizes.filter(
    (s) => s.in_stock
  );

  const sizeVariantMap = Object.fromEntries(
    availableSizes.map((s) => [s.size, s.id])
  );

  return {
    id: dto.id.toString(),

    slug: slugify(dto.name),

    name: dto.name,

    categorySlug: getCategorySlug(dto.category.name),

    price: defaultVariant.selling_price,

    compareAtPrice: defaultVariant.mrp,

    sizes: availableSizes.map((s) => s.size),

    sizeVariantMap,

    images: defaultVariant.images.map((img) =>
      safeImage(img.image_url)
    ),

    hoverImage: safeImage(
      defaultVariant.images[0]?.image_url ?? ""
    ),

    description: dto.description,

    details: [
      dto.fabric,
      `${dto.gsm} GSM`,
    ],

    rating: 5,

    reviewCount: 0,

    popularity: 100,

    tags: dto.tags.map((tag) => tag.name),

    // The backend's own `{ label, value }` rows drive the PDP spec table. `resolveProductHighlights`
    // keys rows by label, so an API row replaces the matching built-in default and any other
    // label is added as-is — no label is hardcoded here.
    highlights: readKeyHighlights(dto.key_highlights).map((row) => ({
      key: `api-${row.label.toLowerCase()}`,
      label: row.label,
      value: row.value,
    })),

    trending: dto.tags.some(
      (tag) => tag.name === "trending"
    ),

    isNew: dto.is_new_arrival,

    salePct: defaultVariant.discount_percentage,

    variantLabel: defaultVariant.color,

    colors: dto.variants.map((v) => v.color),
  };
}