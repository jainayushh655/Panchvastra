import type { Product } from "@/types";
import type { ProductDto } from "@/types/api/ProductDto";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function safeImage(url?: string) {
  const trimmed = url?.trim();
  return trimmed ? trimmed : "/images/no-image.png";
}

function getCategorySlug(category: string) {
  switch (category.toLowerCase()) {
    case "t-shirts":
      return "regular-tee";

    case "shorts":
      return "shorts";

    default:
      return "regular-tee";
  }
}

export function mapProduct(dto: ProductDto): Product {
  return {
    id: dto.id.toString(),

    slug: slugify(dto.name),

    name: dto.name,

    categorySlug: getCategorySlug(dto.category.name),

    price: dto.selling_price,

    compareAtPrice: dto.mrp,

    images: [
      safeImage(dto.primary_image),
    ],

    hoverImage: safeImage(dto.primary_image),

    sizes: [],

    colors: [dto.color],

    description: dto.description,

    details: [
      dto.fabric,
      `${dto.gsm} GSM`,
    ],

    rating: 5,

    reviewCount: 0,

    popularity: 100,

    tags: dto.tags.map((tag) => tag.name),

    highlights: [],

    trending: dto.tags.some(
      (tag) => tag.name.toLowerCase() === "trending"
    ),

    isNew: dto.is_new_arrival,

    salePct: dto.discount_percentage,

    variantLabel: dto.color,
  };
}