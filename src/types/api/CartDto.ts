export interface CartItemDto {
  cart_item_id: number;
  quantity: number;

  product_id: number;
  product_name: string;

  color: string;
  size: string;

  mrp: number;
  selling_price: number;
  discount_amount: number;

  available_stock: number;
  is_in_stock: boolean;

  primary_image: string;
}

/** A quantity-offer tier, as the cart reports the one it applied or the one coming next. */
export interface CartQuantityTierDto {
  min_quantity: number;
  discount_percentage: number;
}

/** The next tier, plus how many more items it takes to reach it. */
export interface NextCartQuantityTierDto extends CartQuantityTierDto {
  /** Items still to add. Drives "Add 1 more item to get 15% off". */
  items_needed: number;
}

export interface CartSummaryDto {
  total_mrp: number;
  total_discount: number;
  subtotal: number;
  item_count: number;

  /* -------------------------------------------------- quantity offer (additive)
   * The backend computes all of this against the whole cart — the tier applies to the
   * TOTAL item count across different products, not per line and not per product. None of
   * it is recalculated on the client: after any quantity change the cart is re-read and
   * whatever comes back is what is shown. Every field is optional so an older response
   * still types, and "absent" means "no offer", which is the same thing as zero here.
   */

  /** Rupees off from the quantity offer. `0` (or absent) hides the summary line. */
  quantity_discount_amount?: number;

  /** The tier currently earned, or null when the cart has not reached one. */
  applied_quantity_tier?: CartQuantityTierDto | null;

  /** The next tier up, or null when the cart is already at the top of the ladder. */
  next_quantity_tier?: NextCartQuantityTierDto | null;

  /**
   * `subtotal − quantity_discount_amount`, BEFORE any coupon.
   *
   * This is the figure to show as the cart total. The coupon is applied after it at
   * checkout, and a coupon's minimum-order check is run against this amount rather than
   * against `subtotal`.
   */
  amount_payable?: number;
}

export interface CartDto {
  items: CartItemDto[];
  summary: CartSummaryDto;
}