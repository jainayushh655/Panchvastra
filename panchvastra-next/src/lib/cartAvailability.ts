import type { CartItem } from '@/types'

/**
 * Whether a cart line can still be ordered, judged only from what the cart API already
 * sent.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 * ──────────────────────────────────────────────────────────────────────────────
 * `GET /v1/cart_management/` returns `is_in_stock` and `available_stock` on every line,
 * and `CartProvider` maps both straight through to `isInStock` / `availableStock`. The
 * Vite checkout never reads either one: an item that sold out after being added still
 * looks orderable, and the customer finds out only when the backend refuses the order.
 *
 * This reads the fields that are already there. It adds no request, no polling and no
 * rule of its own.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * THE BACKEND REMAINS THE SOURCE OF TRUTH
 * ──────────────────────────────────────────────────────────────────────────────
 * This is a pre-flight courtesy, not an authority. Stock can change between the cart read
 * and the order, so the order endpoints still decide — this only stops the obvious case
 * from being walked into, with the information the screen already holds.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * UNKNOWN IS NOT ZERO
 * ──────────────────────────────────────────────────────────────────────────────
 * Both fields are REQUIRED by `CartItemDto`, so a response is only ever missing them if
 * the backend changes or a line arrives malformed. In that case the honest answer is "no
 * information", and no information must not become "out of stock": blocking checkout on
 * an absent field would turn a backend hiccup into a storefront that refuses orders.
 *
 * So each test is positive and explicit:
 *   - `isInStock` blocks only when it is exactly `false` — never when it is absent.
 *   - `availableStock` blocks only when it is a real, finite number at or below zero.
 *
 * Anything else is treated as available and left to the backend, which is where an
 * unknown belongs.
 */
export function isLineUnavailable(line: Pick<CartItem, 'isInStock' | 'availableStock'>): boolean {
  // Strict `=== false`: `undefined` is unknown, not out of stock.
  if (line.isInStock === false) return true

  const stock: unknown = line.availableStock
  if (typeof stock === 'number' && Number.isFinite(stock) && stock <= 0) return true

  return false
}

/** The lines of a cart that cannot currently be ordered. Empty when every line is fine. */
export function unavailableLines<T extends Pick<CartItem, 'isInStock' | 'availableStock'>>(
  lines: readonly T[],
): T[] {
  return lines.filter(isLineUnavailable)
}
