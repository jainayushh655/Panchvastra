'use client'

import Link from 'next/link'
import { BackendImage } from '@/components/BackendImage'
import { useWishlist, type WishlistItem } from '@/context/WishlistProvider'
import { formatInr } from '@/lib/format'

/**
 * Saved items.
 *
 * Ported from the Vite `WishlistPage`, class for class. Page-local presentation only — it
 * reads and writes the SAME `WishlistProvider` the navbar badge reads, so a removal here
 * updates the header count in the same render. No second store, no new API, and
 * `ProductCard` is left untouched: these cards carry actions that card does not have, so
 * they are built here rather than by widening a shared component every other page uses.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHERE THE ITEMS LIVE, AND WHAT "LOGIN SYNCHRONISATION" MEANS HERE
 * ──────────────────────────────────────────────────────────────────────────────
 * There is no wishlist endpoint on this backend — the Vite app verified that every
 * candidate route returns a genuine 404, unlike auth-gated real endpoints which return
 * 401. So the wishlist is browser storage, keyed per signed-in email
 * (`pv_wishlist_v1_<email>`), and `toggleWishlist` is a no-op for a signed-out visitor.
 *
 * That means there is no guest list to merge at sign-in, and none is invented. What
 * "without losing existing items" does require is that signing in RESTORES the account's
 * saved items rather than overwriting them — and that is the specific failure the Phase 3
 * provider was built to prevent: because this app restores the session after mount, the
 * email transitions from null to a value while `items` is still empty, and a verbatim
 * port would have written that empty list over the stored one on every page load. See
 * `WishlistProvider` for the keyed state that makes it impossible.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY "ADD TO CART" IS A LINK
 * ──────────────────────────────────────────────────────────────────────────────
 * Unchanged from the Vite page, and deliberate: the cart API takes a variant SIZE id, and
 * a saved item stores no variant and no size. Adding from here would mean guessing one.
 * The link opens the product's own picker, so stock and size validation stay where they
 * are enforced.
 */

function IconHeart({ className, filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
        d="M12 20.25s-7.5-4.6-9.75-9.1C.75 7.6 2.6 4.5 6 4.5c2 0 3.5 1 6 3.3 2.5-2.3 4-3.3 6-3.3 3.4 0 5.25 3.1 3.75 6.65-2.25 4.5-9.75 9.1-9.75 9.1z"
      />
    </svg>
  )
}

function IconArrowRight({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12h16m0 0-6-6m6 6-6 6" />
    </svg>
  )
}

/** Same rule the shop card uses, so a product shows the same badge in both places. */
function discountPercent(item: WishlistItem): number | null {
  const cmp = item.compareAtPrice
  if (cmp != null && cmp > item.price) return Math.round((1 - item.price / cmp) * 100)
  return null
}

export function WishlistView() {
  const { items, remove } = useWishlist()

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="type-page-title">Wishlist</h1>

      {items.length > 0 ? (
        <p className="mt-1 text-sm text-zinc-500">
          {items.length} saved {items.length === 1 ? 'item' : 'items'}
        </p>
      ) : null}

      {items.length === 0 ? (
        /*
         * `min-h` rather than a full-viewport height: it balances the empty state between
         * the navbar and the footer while leaving the footer in normal page flow, which is
         * what keeps the one-item case from leaving a gap too.
         */
        <div className="flex min-h-[48vh] flex-col items-center justify-center px-4 py-12 text-center">
          <IconHeart className="size-11 text-zinc-900" />

          <h2 className="mt-5 text-2xl font-bold tracking-tight text-black sm:text-3xl">Nothing here yet.</h2>

          <p className="mt-2 max-w-xs text-sm leading-relaxed text-zinc-500">
            Found something you like? Hit the heart and keep it here.
          </p>

          <Link
            href="/shop"
            className="mt-7 inline-flex items-center justify-center gap-2 bg-chocolate px-7 py-3.5 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-zinc-800"
          >
            Explore the collection
            <IconArrowRight className="size-4" />
          </Link>
        </div>
      ) : (
        <ul aria-label="Saved items" className="mt-7 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => {
            const off = discountPercent(item)
            return (
              <li key={item.id} className="flex flex-col border border-zinc-200 bg-white">
                <div className="relative">
                  <Link href={`/product/${item.id}`} className="block" aria-label={item.name}>
                    {/* The ratio box already existed; `relative` is added so `next/image`
                        with `fill` has the positioned ancestor it needs. Same geometry. */}
                    <div className="relative aspect-[4/5] overflow-hidden bg-zinc-100">
                      <BackendImage
                        src={item.image}
                        alt={item.name}
                        fill
                        sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
                        loading="lazy"
                        className="object-cover"
                      />
                    </div>
                  </Link>

                  {off != null && off > 0 ? (
                    <span className="absolute left-2 top-2 z-10 bg-burgundy px-1.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cream">
                      {off}% off
                    </span>
                  ) : null}

                  {/*
                    Filled heart — everything here is already saved, so pressing it removes.
                    Goes straight through the shared provider, so the navbar badge follows.
                  */}
                  <button
                    type="button"
                    onClick={() => remove(item.id)}
                    aria-label={`Remove ${item.name} from wishlist`}
                    className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-black shadow-sm transition-colors hover:border-black"
                  >
                    <IconHeart className="size-4" filled />
                  </button>
                </div>

                {/* `min-w-0` lets the text block shrink inside the flex column so a long
                    unbroken word truncates instead of widening the card. */}
                <div className="flex min-w-0 flex-1 flex-col p-3">
                  <Link
                    href={`/product/${item.id}`}
                    className="line-clamp-2 break-words text-xs font-semibold text-zinc-900 transition-colors hover:text-black"
                  >
                    {item.name}
                  </Link>

                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                    <span className="text-sm font-bold text-black">{formatInr(item.price)}</span>
                    {item.compareAtPrice != null && item.compareAtPrice > item.price ? (
                      <span className="text-xs text-zinc-400 line-through">{formatInr(item.compareAtPrice)}</span>
                    ) : null}
                  </div>

                  {/*
                    `mt-auto` is what fixes the misalignment: grid stretches every card in a
                    row to the tallest, so without it the button floated directly under the
                    price and sat at a different height on a one-line title than a two-line
                    one. Pinned to the bottom, it lines up across the row whatever the title
                    length or item count.
                  */}
                  <div className="mt-auto pt-3">
                    <Link
                      href={`/product/${item.id}`}
                      aria-label={`Add ${item.name} to cart — choose a size`}
                      className="flex min-h-[38px] w-full items-center justify-center bg-chocolate px-2 text-center text-[11px] font-bold uppercase leading-tight tracking-[0.08em] text-cream transition-colors hover:bg-espresso"
                    >
                      Add to cart
                    </Link>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
