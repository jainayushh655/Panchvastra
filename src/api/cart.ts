import api from "./axios";

import type { CartDto } from "@/types/api/CartDto";

export async function getCart(): Promise<CartDto> {
  const response = await api.get("/cart_management/");
  return response.data.data;
}

export async function addToCart(
  variantSizeId: number,
  quantity: number
) {
  const response = await api.post("/cart_management/", {
    variant_size_id: variantSizeId,
    quantity,
  });

  return response.data;
}

export async function updateCartItem(
  cartItemId: number,
  quantity: number
) {
  const response = await api.put("/cart_management/", {
    cart_item_id: cartItemId,
    quantity,
  });

  return response.data;
}
export async function removeCartItem(cartItemId: number) {
  const response = await api.delete(
    `/cart_management/?id=${cartItemId}`
  );

  return response.data;
}