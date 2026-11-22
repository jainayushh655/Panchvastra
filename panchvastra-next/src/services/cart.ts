/**
 * The signed-in customer's server-side cart.
 *
 * Ported verbatim (in contract terms) from the Vite application's `src/api/cart.ts`:
 *   GET    /v1/cart_management/            -> `response.data.data` (a `CartDto`)
 *   POST   /v1/cart_management/            `{ variant_size_id, quantity }`
 *   PUT    /v1/cart_management/            `{ cart_item_id, quantity }`
 *   DELETE /v1/cart_management/?id=<id>
 *
 * The only changes are mechanical: the path comes from `ENDPOINTS.cart` instead of a
 * repeated literal, and DELETE passes `id` through axios `params` rather than hand-built
 * query string — the request on the wire is identical.
 *
 * ⚠️ BROWSER ONLY. Every call carries the shopper's bearer token via the shared client's
 * interceptor, so none of this may be imported into a Server Component.
 */

import api from '@/services/http/client'
import { ENDPOINTS } from '@/services/endpoints'
import type { CartDto } from '@/types/api/CartDto'

export async function getCart(): Promise<CartDto> {
  const response = await api.get(ENDPOINTS.cart)
  return response.data.data
}

export async function addToCart(variantSizeId: number, quantity: number) {
  const response = await api.post(ENDPOINTS.cart, {
    variant_size_id: variantSizeId,
    quantity,
  })

  return response.data
}

export async function updateCartItem(cartItemId: number, quantity: number) {
  const response = await api.put(ENDPOINTS.cart, {
    cart_item_id: cartItemId,
    quantity,
  })

  return response.data
}

export async function removeCartItem(cartItemId: number) {
  const response = await api.delete(ENDPOINTS.cart, { params: { id: cartItemId } })
  return response.data
}
