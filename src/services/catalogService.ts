import { getCategories } from "@/api/category";
import { getProducts } from "@/api/product";

import { mapProductList } from "@/mappers/product/productListMapper";

import type { CatalogSnapshot } from "@/lib/catalogStore";

export async function loadCatalog(): Promise<CatalogSnapshot> {
  const [categories, products] = await Promise.all([
    getCategories(),
    getProducts(),
  ]);

  return {
    revision: Date.now(),

    products: products.map(mapProductList),

    // temporary
    categories: [],

    // we'll replace this later
    homepage: {
      heroSlides: [],
      showcase: {},
    },
  };
}