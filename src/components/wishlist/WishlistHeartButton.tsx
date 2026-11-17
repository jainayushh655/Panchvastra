import { useLocation, useNavigate } from 'react-router-dom'
import { useToast } from '@/context/ToastProvider'
import { useWishlist } from '@/context/WishlistProvider'

/**
 * The heart, everywhere: shop cards, the product page, related-product cards.
 *
 * One component so every heart behaves identically — same optimistic toggle, same
 * sign-in redirect for guests, same rollback message — rather than each surface
 * re-implementing it slightly differently.
 *
 * A guest tap is not an error: the intent is remembered by `WishlistProvider` and the
 * visitor is sent to sign in carrying their return path, so they land back where they
 * were with the product already saved.
 */

export function HeartIcon({ filled, className = 'size-5' }: { filled: boolean; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 20.25s-7.5-4.6-9.75-9.1C.75 7.6 2.6 4.5 6 4.5c2 0 3.5 1 6 3.3 2.5-2.3 4-3.3 6-3.3 3.4 0 5.25 3.1 3.75 6.65-2.25 4.5-9.75 9.1-9.75 9.1z"
      />
    </svg>
  )
}

type Variant =
  /** Large square button beside Add to Cart on the product page. */
  | 'pdp'
  /** Small circular button floating over a product card image. */
  | 'card'

type WishlistHeartButtonProps = {
  productId: string | number
  variant?: Variant
  className?: string
}

export function WishlistHeartButton({ productId, variant = 'card', className = '' }: WishlistHeartButtonProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  const { isWishlisted, isPending, toggle } = useWishlist()

  const wishlisted = isWishlisted(productId)
  const busy = isPending(productId)

  const handleClick = async (event: React.MouseEvent) => {
    // Hearts on product cards sit inside a <Link>; without this the tap would navigate.
    event.preventDefault()
    event.stopPropagation()

    const result = await toggle(productId)
    if (result.ok) return

    if (result.reason === 'auth') {
      navigate('/login', { state: { from: `${location.pathname}${location.search}` } })
      return
    }

    showToast('Wishlist not updated', { variant: 'warning', description: result.message })
  }

  const label = wishlisted ? 'Remove from wishlist' : 'Save to wishlist'

  if (variant === 'pdp') {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        aria-pressed={wishlisted}
        aria-label={label}
        title={label}
        className={`flex size-[52px] shrink-0 items-center justify-center rounded-xl border transition-colors disabled:opacity-60 ${
          wishlisted
            ? 'border-burgundy bg-burgundy text-cream'
            : 'border-sand text-espresso hover:border-burgundy'
        } ${className}`}
      >
        <HeartIcon filled={wishlisted} />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-pressed={wishlisted}
      aria-label={label}
      title={label}
      className={`flex size-8 items-center justify-center rounded-full border border-sand bg-cream/90 backdrop-blur-sm transition-colors disabled:opacity-60 ${
        wishlisted ? 'text-burgundy' : 'text-espresso hover:text-burgundy'
      } ${className}`}
    >
      <HeartIcon filled={wishlisted} className="size-4" />
    </button>
  )
}
