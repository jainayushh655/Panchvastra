import type { QuantityDiscountTierDto } from '@/types/api/ProductDetailDto'

/**
 * The burgundy banner: recent buyers on the left, the quantity ladder on the right.
 *
 * Two independent pieces of information that share one surface because the design puts
 * them there. Each hides on its own:
 *   - no recent buyers (`0`) → the left block goes, the offer stretches across
 *   - no tiers configured    → the right block goes, the buyer count stretches across
 *   - neither                → nothing renders at all
 *
 * ⚠️ THE TIERS APPLY TO THE WHOLE CART, not to this product. "BUY 2 GET 10% OFF" means
 * two items in the cart, across any products. The copy says "more you shop" rather than
 * "buy 2 of this" for exactly that reason, and the real figures only ever come from the
 * cart summary and the checkout response — nothing here is used to compute a total.
 */

function IconPeople({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M9 11.5a3.25 3.25 0 100-6.5 3.25 3.25 0 000 6.5zM9 13c-3.1 0-5.75 1.6-5.75 3.6V19h11.5v-2.4C14.75 14.6 12.1 13 9 13z" />
      <path d="M16.5 11.5a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5zM16.3 13c-.6 0-1.17.06-1.69.17 1.2.86 1.94 2.03 1.94 3.43V19h4.2v-2.2c0-1.82-2-3.8-4.45-3.8z" />
    </svg>
  )
}

function IconTag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        d="M12.6 3.5h5.9a2 2 0 012 2v5.9a2 2 0 01-.6 1.4l-7.2 7.2a2 2 0 01-2.8 0l-5.9-5.9a2 2 0 010-2.8l7.2-7.2a2 2 0 011.4-.6z"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <circle cx="16.6" cy="7.4" r="1.4" strokeWidth={1.5} />
    </svg>
  )
}

/** Trims a trailing ".0" so 10.0 reads as "10%" and 12.5 still reads as "12.5%". */
function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)))
}

type PurchaseOfferBannerProps = {
  recentPurchaseCount?: number | null
  tiers?: QuantityDiscountTierDto[] | null
}

export function PurchaseOfferBanner({ recentPurchaseCount, tiers }: PurchaseOfferBannerProps) {
  const buyers = typeof recentPurchaseCount === 'number' && recentPurchaseCount > 0 ? recentPurchaseCount : 0

  const offers = (tiers ?? [])
    .filter((tier) => tier && tier.min_quantity >= 1 && tier.discount_percentage > 0)
    // Ascending, so the ladder reads the way a shopper climbs it.
    .sort((a, b) => a.min_quantity - b.min_quantity)

  if (buyers === 0 && offers.length === 0) return null

  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-burgundy/30">
      <div className="flex flex-col sm:flex-row">
        {buyers > 0 ? (
          <div className="flex items-center gap-3 bg-burgundy px-5 py-4 text-cream sm:w-[46%] sm:shrink-0">
            <IconPeople className="size-6 shrink-0" />
            <p className="min-w-0 font-sans text-sm leading-snug">
              <span className="block text-xl font-bold leading-none">{buyers.toLocaleString('en-IN')}</span>
              <span className="mt-1 block text-xs text-cream/85">
                {buyers === 1 ? 'person bought this' : 'people bought this'} in the last 30 days
              </span>
            </p>
          </div>
        ) : null}

        {offers.length > 0 ? (
          <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-2.5 bg-soft-beige px-5 py-4 text-center">
            <p className="font-display text-sm font-bold uppercase leading-tight tracking-wide text-burgundy">
              More you shop,
              <br />
              more you save
            </p>

            {/* Wraps rather than scrolls: at 375px two chips stack cleanly, and a
                horizontally scrolling offer is an offer people do not see. */}
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {offers.map((tier) => (
                <li
                  key={`${tier.min_quantity}-${tier.discount_percentage}`}
                  className="flex items-center gap-1.5 font-sans text-[11px] font-bold uppercase leading-tight tracking-wide text-espresso"
                >
                  <IconTag className="size-4 shrink-0 text-burgundy" />
                  <span>
                    Buy {tier.min_quantity}
                    <br />
                    Get {formatPercent(tier.discount_percentage)}% off
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}
