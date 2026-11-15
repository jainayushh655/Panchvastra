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

export interface CartSummaryDto {
  total_mrp: number;
  total_discount: number;
  subtotal: number;
  item_count: number;
}

export interface CartDto {
  items: CartItemDto[];
  summary: CartSummaryDto;
}