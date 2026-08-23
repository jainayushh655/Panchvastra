import type { Product } from "@/types";
import type { ProductDto } from "@/types/api/ProductDto";
import { categoryNameToSlug, subCategoryNameToSlug } from "@/lib/categorySlug";

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

export function mapProduct(dto: ProductDto): Product {
  const subCategoryName = dto.sub_category?.name ?? "";

  return {
    id: dto.id.toString(),

    slug: slugify(dto.name),

    name: dto.name,

    categorySlug: categoryNameToSlug(dto.category?.name ?? ""),

    subCategorySlug: subCategoryName ? subCategoryNameToSlug(subCategoryName) : undefined,

    subCategoryId: dto.sub_category?.id,

    subCategoryName: subCategoryName || undefined,

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