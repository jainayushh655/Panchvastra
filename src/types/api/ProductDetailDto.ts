export interface ProductDetailDto {
  id: number;
  name: string;
  description: string;
  fabric: string;
  gsm: number;
  is_featured: boolean;
  is_new_arrival: boolean;
  created_at: string;
  /**
   * `{ label, value }[]` per the current contract. Typed as `unknown` because a legacy
   * product may still read back in the old string form; every consumer goes through
   * `readKeyHighlights` rather than trusting the shape.
   */
  key_highlights: unknown;

  /**
   * Curated position in the catalogue, 1-based.
   *
   * Optional: a product saved before the backend added the field, or one the admin never
   * ordered, simply has none. A missing value is NOT treated as 0 — the admin form leaves
   * its input blank and omits the key on save, which preserves whatever the backend holds.
   */
  display_order?: number | null;

  category: {
    id: number;
    name: string;
  };

  /** Null when the product has no subcategory. */
  sub_category: {
    id: number;
    name: string;
  } | null;

  /** Flat mirrors of `sub_category`, also present on the detail response. */
  sub_category_id?: number | null;

  sub_category_name?: string | null;

  tags: TagDto[];

  variants: VariantDto[];
}

export interface TagDto {
  id: number;
  name: string;
}

export interface VariantDto {
  id: number;
  sku: string;

  color: string;

  mrp: number;

  selling_price: number;

  cost_price: number | null;

  is_default: boolean;

  /**
   * Curated position among this product's variants, 1-based. The detail response already
   * returns `variants` sorted by it, so nothing re-sorts client-side. Optional, never
   * assumed to be 0.
   */
  display_order?: number | null;

  discount_amount: number;

  discount_percentage: number;

  total_stock: number;

  in_stock: boolean;

  images: VariantImageDto[];

  sizes: VariantSizeDto[];
}

export interface VariantImageDto {
  id: number;

  image_url: string;

  display_order: number;
}

export interface VariantSizeDto {
  id: number;

  size: string;

  stock_quantity: number;

  in_stock: boolean;
}