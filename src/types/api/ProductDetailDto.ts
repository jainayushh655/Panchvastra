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

  /* ------------------------------------------------- additive product-page fields
   * Everything below was ADDED by the backend for the redesigned product page. Each is
   * optional here rather than required, because this same `ProductDetailDto` is also read
   * by the admin product editor, and a response from an older deployment (or a cached one)
   * must not fail to type. Every consumer treats "absent" as "hide that part of the page",
   * which is the same thing the contract says an empty value means.
   */

  /**
   * Aggregate review figures, computed server-side.
   *
   * Null/absent and `total_reviews === 0` both mean the same thing to the UI: hide the
   * whole rating row rather than render "0.0 (0 Reviews)".
   */
  rating_summary?: ProductRatingSummaryDto | null;

  /** Distinct buyers in the last 30 days. `0` hides the social-proof block. */
  recent_purchase_count?: number | null;

  /**
   * "More you shop, more you save" tiers.
   *
   * IMPORTANT: these apply to the TOTAL number of items in the cart, across products —
   * not to this product alone. The product page shows them as an incentive; the cart and
   * the checkout response are where the real figures come from.
   *
   * May be empty (hide the box), one tier, or many.
   */
  quantity_discount_tiers?: QuantityDiscountTierDto[] | null;

  /**
   * The size chart configured for this product's CATEGORY, resolved server-side.
   *
   * Null when the category has no chart — the "Size Guide" link is then not rendered at
   * all rather than opening an empty or wrong table.
   */
  size_chart?: ProductSizeChartDto | null;
}

/** Aggregate review figures shown beside the product title. */
export interface ProductRatingSummaryDto {
  /** 0–5, one decimal. Rendered with half-star support. */
  average_rating: number;
  total_reviews: number;
  /** Whole percent of reviewers who recommended the product. */
  recommend_percentage: number;
}

/** One "buy N, save X%" tier. */
export interface QuantityDiscountTierDto {
  /** Cart item count at which the tier starts. Always ≥ 2. */
  min_quantity: number;
  /** Percent off, e.g. `10.0`. */
  discount_percentage: number;
}

/**
 * A size chart as the product response embeds it.
 *
 * This is the backend-driven replacement for the hardcoded category→artwork mapping in
 * `src/lib/sizeChart.ts`: a real table the admin maintains, rather than three PNGs and a
 * lookup that had to be edited to add a category.
 */
export interface ProductSizeChartDto {
  id: number;
  /** Measurement unit for every cell. */
  unit: SizeChartUnit;
  /** Header row, e.g. `["Size", "Chest", "Length"]`. */
  headers: string[];
  /** Body rows. Each row has exactly one value per header. */
  rows: string[][];
  /** Free-text guidance shown under the table. May be empty. */
  notes?: string | null;
}

export type SizeChartUnit = 'IN' | 'CM';

/**
 * What a gallery item actually is.
 *
 * Videos used to be impossible: the gallery assumed every entry was an image. The backend
 * now returns `media_type` on each item, and videos are attached through a separate
 * direct-to-storage upload rather than the product multipart form.
 */
export type MediaType = 'IMAGE' | 'VIDEO';

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

  /**
   * `"IMAGE"` or `"VIDEO"`. Optional so an older response still types; an absent value is
   * read as `"IMAGE"`, which is what every item was before videos existed.
   *
   * Only `IMAGE` entries take part in zoom/fullscreen — a lightbox is for stills, and a
   * `<video>` already has its own fullscreen control.
   */
  media_type?: MediaType;
}

export interface VariantSizeDto {
  id: number;

  size: string;

  stock_quantity: number;

  in_stock: boolean;
}