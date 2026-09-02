export interface ProductDetailDto {
  id: number;
  name: string;
  description: string;
  fabric: string;
  gsm: number;
  is_featured: boolean;
  is_new_arrival: boolean;
  created_at: string;
  key_highlights: string;

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