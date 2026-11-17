import type { QuantityDiscountTierDto } from '@/types/api/ProductDetailDto'

/**
 * The Buy Now handoff — product page → checkout, surviving a sign-in detour.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY `sessionStorage` AND NOT ROUTE STATE
 * ──────────────────────────────────────────────────────────────────────────────
 * Route state is the obvious choice and it does not survive the two things that actually
 * happen here:
 *
 *   1. A GUEST tapping Buy Now goes product → login → OTP → checkout. Route state is
 *      attached to one navigation; it is gone by the time they arrive, and the checkout
 *      would fall back to the cart — quietly ordering the wrong things.
 *   2. A refresh on the checkout page drops `history.state` in several browsers, which
 *      would turn a one-item purchase into a whole-cart purchase on reload.
 *
 * `sessionStorage` survives both, is scoped to the tab (so a second tab buying something
 * else does not collide with this one), and is cleared the moment the order is placed.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHAT IS AND IS NOT AUTHORITATIVE HERE
 * ──────────────────────────────────────────────────────────────────────────────
 * `variantSizeId` and `quantity` are the only fields sent to the backend. Everything else
 * — name, image, colour, prices, tiers — is DISPLAY DATA, carried so the checkout summary
 * can render the item without re-fetching the product.
 *
 * The prices here are a PREVIEW. The backend computes the real subtotal, the quantity
 * discount, the coupon and the total, and the amounts shown after the order is created
 * always come from its response, never from this.
 */

const STORAGE_KEY = 'pv_buy_now_v1'

/** Marks the checkout as being in Buy Now mode. Present in the URL so a refresh keeps it. */
export const BUY_NOW_PARAM = 'mode'
export const BUY_NOW_VALUE = 'buy-now'

export type BuyNowIntent = {
  /** The ONLY identifier the checkout endpoints receive, alongside `quantity`. */
  variantSizeId: number
  quantity: number

  /* ----- display only, never sent ----- */
  productId: number
  name: string
  image: string
  color: string
  size: string
  /** Selling price per unit, for the preview line. */
  unitPrice: number
  /** MRP per unit, for the struck-through price. 0 when there is no discount. */
  mrp: number
  /** Tiers from the product response, used only to preview the quantity offer. */
  tiers: QuantityDiscountTierDto[]
}

function isBuyNowIntent(value: unknown): value is BuyNowIntent {
  if (!value || typeof value !== 'object') return false
  const intent = value as Partial<BuyNowIntent>
  return (
    typeof intent.variantSizeId === 'number' &&
    Number.isFinite(intent.variantSizeId) &&
    typeof intent.quantity === 'number' &&
    intent.quantity >= 1
  )
}

export function saveBuyNowIntent(intent: BuyNowIntent): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent))
  } catch {
    // Storage unavailable: the checkout will fall back to cart mode, which is the safe
    // direction — it shows the real cart rather than inventing an order.
  }
}

export function readBuyNowIntent(): BuyNowIntent | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isBuyNowIntent(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Clears the intent.
 *
 * Called on a placed order, and whenever the checkout decides it is NOT in Buy Now mode —
 * a stale intent left behind by an abandoned attempt must never attach itself to the next
 * ordinary cart checkout.
 */
export function clearBuyNowIntent(): void {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing to do — the value was already unreachable.
  }
}

/** The checkout URL for a Buy Now purchase. */
export function buyNowCheckoutPath(): string {
  return `/checkout?${BUY_NOW_PARAM}=${BUY_NOW_VALUE}`
}

/**
 * Best tier for a given item count, or null.
 *
 * PREVIEW ONLY. The real discount is computed by the backend against the whole cart, and
 * on a Buy Now order against just this item. Shown so the shopper is not surprised by a
 * number appearing for the first time on the confirmation.
 */
export function bestTierForQuantity(
  tiers: QuantityDiscountTierDto[] | null | undefined,
  quantity: number,
): QuantityDiscountTierDto | null {
  if (!tiers?.length) return null

  return (
    tiers
      .filter((tier) => quantity >= tier.min_quantity && tier.discount_percentage > 0)
      // Highest percentage wins, so overlapping tiers behave the way a shopper expects.
      .sort((a, b) => b.discount_percentage - a.discount_percentage)[0] ?? null
  )
}
