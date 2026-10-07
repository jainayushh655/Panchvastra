import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { formatInr } from '@/lib/format'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useCart } from '@/context/CartProvider'
import { useToast } from '@/context/ToastProvider'
import { useWishlist } from '@/context/WishlistProvider'
import { removeCartItem, updateCartItem } from '@/api/cart'
import type { CartItem } from '@/types'

function IconBag({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l-1 12H6L5 9z" />
    </svg>
  )
}

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12h16m0 0-6-6m6 6-6 6" />
    </svg>
  )
}

/**
 * The same outline heart the Wishlist page draws, so "Move to wishlist" carries the mark its
 * destination is identified by everywhere else in the UI.
 */
function IconHeart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
        d="M12 20.25s-7.5-4.6-9.75-9.1C.75 7.6 2.6 4.5 6 4.5c2 0 3.5 1 6 3.3 2.5-2.3 4-3.3 6-3.3 3.4 0 5.25 3.1 3.75 6.65-2.25 4.5-9.75 9.1-9.75 9.1z"
      />
    </svg>
  )
}

function IconTruck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.6}
        d="M3 6.75h10.5v8.5H3zM13.5 9.75H17l3 3v2.5h-6.5zM7.25 17.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5zM17.25 17.75a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5z"
      />
    </svg>
  )
}

/**
 * Savings on a single line, as a whole percent off the MRP. Derived from the two prices the
 * cart API already sends (`mrp` / `selling_price`), because the cart item contract carries
 * `discount_amount` but no `discount_percentage`.
 */
function discountPercent(price: number, mrp?: number) {
  if (!mrp || mrp <= price) return 0
  return Math.round(((mrp - price) / mrp) * 100)
}

export function CartPage() {
  useDocumentTitle('Cart')
  const { items, refreshCart, subtotal, totalItems, totalDiscount, totalMrp } = useCart()
  const { showToast } = useToast()
  const { isWishlisted, toggleWishlist } = useWishlist()

  /** Cart item ids with a request in flight, so a line's own controls are the only ones
      disabled while it updates and a fast double-click can't fire a second request. */
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set())

  const withPending = async (cartItemId: number, run: () => Promise<void>) => {
    setPendingIds((prev) => new Set(prev).add(cartItemId))
    try {
      await run()
    } catch (err) {
      console.error(err)
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(cartItemId)
        return next
      })
    }
  }

  const handleUpdateQuantity = (line: CartItem, requestedQuantity: number) => {
    if (pendingIds.has(line.cartItemId)) return

    const nextQuantity = Math.max(1, requestedQuantity)

    if (nextQuantity > line.availableStock) {
      showToast(`Only ${line.availableStock} item${line.availableStock === 1 ? '' : 's'} available in stock.`, {
        variant: 'warning',
      })
      return
    }

    void withPending(line.cartItemId, async () => {
      await updateCartItem(line.cartItemId, nextQuantity)
      await refreshCart()
    })
  }

  const handleRemoveItem = (cartItemId: number) => {
    if (pendingIds.has(cartItemId)) return
    void withPending(cartItemId, async () => {
      await removeCartItem(cartItemId)
      await refreshCart()
    })
  }

  /**
   * Moves a line to the wishlist: adds it (via the EXISTING wishlist context — no new
   * storage, no new API) and then removes it from the cart through the same remove path
   * every other removal uses. `toggleWishlist` would un-save an item that's already
   * wishlisted, so it's only called when the product isn't there yet; either way the cart
   * line is removed, matching a "move" rather than a "copy".
   */
  const handleMoveToWishlist = (line: CartItem) => {
    if (pendingIds.has(line.cartItemId)) return
    if (!isWishlisted(line.productId)) {
      toggleWishlist({
        id: line.productId,
        name: line.name,
        image: line.image,
        price: line.price,
        compareAtPrice: line.mrp ?? null,
      })
    }
    showToast('Moved to wishlist.')
    handleRemoveItem(line.cartItemId)
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* A size larger than the shared `.type-page-title`, matching the reference. The
          override is scoped to this one heading rather than applied to the shared utility,
          so no other page title moves with it. */}
      <h1 className="type-page-title sm:text-4xl">Cart</h1>

      {items.length === 0 ? (
        /*
         * `min-h` balances the empty state between the navbar and footer while leaving the
         * footer in normal page flow — the same approach used on the Wishlist empty state.
         */
        <div className="flex min-h-[48vh] flex-col items-center justify-center px-4 py-12 text-center">
          <IconBag className="size-11 text-zinc-900" />

          <h2 className="mt-5 text-2xl font-bold tracking-tight text-black sm:text-3xl">Your cart is empty.</h2>

          <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">Your next rotation starts here.</p>

          <Link
            to="/shop"
            className="mt-7 inline-flex items-center justify-center gap-2 bg-black px-7 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-800"
          >
            Shop the collection
            <IconArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        // Summary column widened to the reference proportions (~30% of the container). The
        // grid opens directly beneath the h1 so the summary card's top edge sits level with
        // the "N items in your cart" line, as it does in the reference.
        <div className="mt-3 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0">
            {/* Counts LINES, not units: two products at quantities 2 and 1 read as
                "2 items in your cart" here and "(3 items)" in the summary, which is the
                split the reference shows. */}
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
              {items.length} item{items.length === 1 ? '' : 's'} in your cart
            </p>

            <ul aria-label="Cart items" className="mt-2 divide-y divide-zinc-200 dark:divide-zinc-800">
              {items.map((line) => {
                const off = discountPercent(line.price, line.mrp)
                return (
                  // Below 375px the reference's desktop sizing no longer fits the row: the
                  // image, gap and stepper together overflow a 320px phone, so each steps
                  // down one notch there and is unchanged everywhere else.
                  <li key={line.cartItemId} className="flex gap-5 py-4 max-[374px]:gap-4">
                    {/*
                      The thumbnail still fills the SAME height as the text column beside it —
                      `self-stretch` ties it to the row, so a 2-line product name or a wrapped
                      mobile action row grows the image with it rather than against a guessed
                      pixel value.

                      `min-h-36` is the floor the reference design sets: with a single-line
                      name the text column alone is only ~120px, which left the image looking
                      undersized, so the row is held to 144px and the image reads as a proper
                      portrait that extends a little above the name and below the quantity
                      control. Because it is a MINIMUM, taller content still wins and the
                      stretch behaviour is unchanged. `object-cover` keeps the crop undistorted
                      at any resulting height.
                    */}
                    <Link
                      to={`/product/${line.productId}`}
                      className="block w-30 shrink-0 self-stretch min-h-36 max-[374px]:w-24 max-[374px]:min-h-32"
                    >
                      <img
                        src={line.image}
                        alt=""
                        className="h-full w-full rounded-md border border-zinc-200 object-cover"
                      />
                    </Link>
                    {/* `min-w-0` lets this column shrink inside the flex row so a long product
                        name wraps instead of pushing the thumbnail or overflowing the page. */}
                    <div className="min-w-0 flex-1">
                      <Link
                        to={`/product/${line.productId}`}
                        className="break-words font-semibold text-zinc-900 dark:text-white"
                      >
                        {line.name}
                      </Link>
                      <p className="text-sm text-zinc-500">
                        Size {line.size}
                        {line.color ? ` · ${line.color}` : ''}
                      </p>
                      {/* Selling price prominent, MRP struck through, then the saving as a
                          percentage — the same three-part pattern the Product Detail page
                          uses. Every value comes from the cart API. */}
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-sm font-bold">{formatInr(line.price)}</span>
                        {(line.mrp ?? 0) > line.price ? (
                          <span className="text-xs text-zinc-400 line-through">{formatInr(line.mrp ?? 0)}</span>
                        ) : null}
                        {off > 0 ? (
                          <span className="rounded bg-[#eaf7ed] px-2.5 py-1 text-[10px] font-bold leading-[1.2] text-[#1e7d39] dark:bg-emerald-950 dark:text-emerald-300">
                            {off}% OFF
                          </span>
                        ) : null}
                      </p>
                      {/*
                        One compact row: quantity stepper, Remove, Move to wishlist, divided by
                        hairline rules — matching the reference, where these sit side by side
                        rather than the actions dropping to a line of their own. `flex-wrap` is
                        what keeps this safe on a narrow phone: there is plenty of width for
                        all of them on a desktop-width cart column, so the row only wraps where
                        it actually needs to.
                      */}
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                        {/* Wider and slightly flatter than before, matching the reference: the
                            − / + targets keep their 32px size, the room comes from the padding,
                            the gaps and a roomier value field. */}
                        <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-0.5 text-sm max-[374px]:gap-1 max-[374px]:px-2 dark:border-zinc-700 dark:bg-zinc-900">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(line, line.quantity - 1)}
                            disabled={line.quantity <= 1 || pendingIds.has(line.cartItemId)}
                            aria-label="Decrease quantity"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-base font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={line.availableStock || 1}
                            value={line.quantity}
                            disabled={pendingIds.has(line.cartItemId)}
                            onChange={(event) => handleUpdateQuantity(line, Number(event.target.value) || 1)}
                            className="w-14 max-[374px]:w-10 border-none bg-transparent text-center text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 disabled:opacity-40 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          {/* Stays clickable right up to the stock ceiling — a click AT the
                              ceiling is what triggers the "only X available" toast, rather
                              than the button just going quietly dead. */}
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(line, line.quantity + 1)}
                            disabled={line.availableStock <= 0 || pendingIds.has(line.cartItemId)}
                            aria-label="Increase quantity"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-base font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                          >
                            +
                          </button>
                        </div>
                        {/*
                          No "N left" badge: remaining stock is not surfaced on this row. The
                          stock ceiling is still enforced — `max` on the input, and a toast
                          when a quantity above `availableStock` is attempted — so the limit
                          is communicated at the moment it matters rather than standing in the
                          row permanently.
                        */}

                        {/*
                          The two hairline rules and both actions are grouped into ONE flex
                          item with `shrink-0`, so `flex-wrap` on the row above can only move
                          the group onto a new line as a whole. Split, it would otherwise
                          orphan a bare divider at the start of a line on a narrow phone.

                          Both actions share the SAME plain treatment — colour, size and
                          weight, with NO underline in any state. Hover shifts the colour
                          instead, so there is still an interaction cue without the link
                          styling. Remove is not red.
                        */}
                        <div className="flex shrink-0 items-center gap-4">
                          {/* The rule that separates the stepper from Remove. Below `sm` the
                              text column is too narrow to hold the stepper and the actions on
                              one line, so this group always wraps there — and a hairline at
                              the START of a wrapped line reads as a stray mark rather than a
                              separator. It is hidden at exactly the widths where that happens
                              and shown at every width where the row stays on one line. */}
                          <span className="hidden h-4 w-px bg-zinc-200 sm:block dark:bg-zinc-700" aria-hidden />
                          <button
                            type="button"
                            className="inline-flex min-h-[32px] items-center text-xs font-semibold text-zinc-700 hover:text-black disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:text-white"
                            onClick={() => handleRemoveItem(line.cartItemId)}
                            disabled={pendingIds.has(line.cartItemId)}
                          >
                            Remove
                          </button>
                          <span className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" aria-hidden />
                          <button
                            type="button"
                            className="inline-flex min-h-[32px] items-center gap-2 text-xs font-semibold text-zinc-700 hover:text-black disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-300 dark:hover:text-white"
                            onClick={() => handleMoveToWishlist(line)}
                            disabled={pendingIds.has(line.cartItemId)}
                          >
                            <IconHeart className="size-4" />
                            Move to wishlist
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Compact card: thin border, small radius, tight padding — matches the reference
              rather than reading as a large sidebar. */}
          <aside className="h-fit rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="type-label">Order Summary</p>

            {/*
              Subtotal is the PRE-discount total (cart `summary.total_mrp`) and Discount is the
              saving the backend has already applied (`summary.total_discount`), so the rows
              read as an arithmetic the shopper can follow down to Total. None of it is
              invented in the UI: the provider falls back to the line items only when the API
              sends no summary at all.

              There is no shipping row because nothing is charged for shipping today — the
              notice at the foot of the card states that outright instead.
            */}
            <div className="mt-4 space-y-2.5 text-sm">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>
                  Subtotal ({totalItems} item{totalItems === 1 ? '' : 's'})
                </span>
                <span className="tabular-nums">{formatInr(totalMrp)}</span>
              </div>
              {totalDiscount > 0 ? (
                <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                  <span>Discount</span>
                  <span className="tabular-nums">- {formatInr(totalDiscount)}</span>
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-zinc-200 pt-4 dark:border-zinc-800">
              <span className="text-lg font-bold text-black dark:text-white">Total</span>
              <span className="text-lg font-bold tabular-nums text-black dark:text-white">{formatInr(subtotal)}</span>
            </div>

            <Link to="/checkout" className="mt-4 block">
              <Button className="min-h-[46px] w-full gap-2.5 text-xs tracking-[0.14em]" size="lg" type="button">
                Checkout
                <IconArrowRight className="size-4" />
              </Button>
            </Link>

            <Link
              to="/shop"
              className="mt-4 block text-center text-sm font-semibold text-black underline underline-offset-2 dark:text-white"
            >
              Continue Shopping
            </Link>

            {/* Static copy, not a calculated line: nothing is charged for shipping today, so
                there is no figure to show — only the policy, in the one place a shopper looks
                for it before committing to checkout. */}
            <div className="mt-8 flex items-start gap-3 rounded-lg bg-[#eef9f1] p-3 dark:bg-emerald-950/40">
              <IconTruck className="size-5 shrink-0 text-zinc-900 dark:text-emerald-200" />
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-tight text-zinc-900 dark:text-emerald-100">
                  Free shipping on all orders
                </p>
                <p className="mt-0.5 text-xs leading-tight text-zinc-500 dark:text-emerald-200/70">
                  No additional shipping charges.
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
