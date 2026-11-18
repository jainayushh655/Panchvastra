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

/* ------------------------------------------------------------------ the URL */

/**
 * The essentials also travel in the URL, not only in `sessionStorage`.
 *
 * `sessionStorage` is per-tab and can be unavailable (Safari private mode, some enterprise
 * policies). When it is lost, the page would previously fall back to CART mode — quietly
 * turning a one-item purchase into a whole-cart checkout, or into a "your cart is empty"
 * dead end when the cart happens to be empty. Neither is acceptable for a flow the
 * shopper explicitly asked for.
 *
 * So the three values the order actually depends on ride in the query string, where they
 * survive a refresh, a new tab, a shared link and a cleared storage. The display data
 * (name, image, prices) stays in `sessionStorage`; when it is missing the checkout
 * re-fetches the product rather than guessing.
 */
const PARAM_VARIANT_SIZE = 'vs'
const PARAM_QUANTITY = 'qty'
const PARAM_PRODUCT = 'p'

/** What the URL alone can tell us: enough to place the order, not enough to draw it. */
export type BuyNowKeys = {
  variantSizeId: number
  quantity: number
  productId: number
}

/** The checkout URL for a Buy Now purchase. */
export function buyNowCheckoutPath(intent: BuyNowKeys): string {
  const params = new URLSearchParams({
    [BUY_NOW_PARAM]: BUY_NOW_VALUE,
    [PARAM_VARIANT_SIZE]: String(intent.variantSizeId),
    [PARAM_QUANTITY]: String(intent.quantity),
    [PARAM_PRODUCT]: String(intent.productId),
  })
  return `/checkout?${params.toString()}`
}

/** True when the URL asks for Buy Now mode, whether or not an intent can be resolved. */
export function isBuyNowRequested(params: URLSearchParams): boolean {
  return params.get(BUY_NOW_PARAM) === BUY_NOW_VALUE
}

function positiveInt(raw: string | null): number | null {
  if (!raw) return null
  const value = Number(raw)
  return Number.isInteger(value) && value > 0 ? value : null
}

/** Reads the order-critical values out of the URL. Null when any of them is unusable. */
export function readBuyNowKeysFromParams(params: URLSearchParams): BuyNowKeys | null {
  const variantSizeId = positiveInt(params.get(PARAM_VARIANT_SIZE))
  const productId = positiveInt(params.get(PARAM_PRODUCT))
  const quantity = positiveInt(params.get(PARAM_QUANTITY)) ?? 1

  if (variantSizeId === null || productId === null) return null

  return { variantSizeId, quantity, productId }
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
