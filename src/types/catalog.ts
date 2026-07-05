import type { CategoryDto } from "@/types/api/CategoryDto";
import type { ProductDto } from "@/types/api/ProductDto";

export interface CatalogData {
  categories: CategoryDto[];
  products: ProductDto[];
}