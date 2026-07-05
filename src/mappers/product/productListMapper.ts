import type { Product } from "@/types";
import type { ProductDto } from "@/types/api/ProductDto";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getCategorySlug(categoryId: number): string {
  switch (categoryId) {
    case 1:
      return "regular-tee";

    case 2:
      return "shorts";

    default:
      return "regular-tee";
  }
}

export function mapProductList(dto: ProductDto): Product {
  return {
    id: dto.id.toString(),

    slug: slugify(dto.name),

    name: dto.name,

    categorySlug: getCategorySlug(dto.category.id),

    price: dto.selling_price,

    compareAtPrice: dto.mrp,

    sizes: [],

    images: [dto.primary_image],

    hoverImage: dto.primary_image,

    description: dto.description,

    details: [],

    rating: 0,

    reviewCount: 0,

    popularity: 0,

    tags: dto.tags.map(tag => tag.name),

    highlights: [],

    trending: dto.tags.some(tag => tag.name === "trending"),

    isNew: dto.is_new_arrival,

    salePct: dto.discount_percentage,
  };
}