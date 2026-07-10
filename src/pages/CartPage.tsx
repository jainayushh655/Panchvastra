import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { formatInr } from '@/lib/format'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { useCart } from '@/context/CartProvider'
import { removeCartItem, updateCartItem } from '@/api/cart'

export function CartPage() {
  useDocumentTitle('Cart')
  const { items, refreshCart, subtotal } = useCart()

  const shipping = subtotal > 0 ? (subtotal >= 499 ? 0 : 99) : 0

  const handleUpdateQuantity = async (cartItemId: number, quantity: number) => {
    try {
      await updateCartItem(cartItemId, quantity)
      await refreshCart()
    } catch (err) {
      console.error(err)
    }
  }

  const handleRemoveItem = async (cartItemId: number) => {
    try {
      await removeCartItem(cartItemId)
      await refreshCart()
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="type-page-title">
        Cart
      </h1>

      {items.length === 0 ? (
        <p className="mt-8 text-zinc-600 dark:text-zinc-400">
          Your cart is quiet.{' '}
          <Link to="/shop" className="font-semibold text-orange-600 dark:text-orange-400">
            Fill it →
          </Link>
        </p>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_360px]">
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {items.map((line) => (
              <li key={line.cartItemId} className="flex gap-4 py-6">
                <Link to={`/product/${line.productId}`} className="shrink-0">
                  <img
                    src={line.image}
                    alt=""
                    className="h-28 w-24 rounded-2xl object-cover"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/product/${line.productId}`}
                    className="font-semibold text-zinc-900 dark:text-white"
                  >
                    {line.name}
                  </Link>
                  <p className="text-sm text-zinc-500">
                    Size {line.size}
                    {line.color ? ` · ${line.color}` : ''}
                  </p>
                  <p className="mt-1 text-sm font-bold">{formatInr(line.price)}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-50 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900">
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(line.cartItemId, Math.max(1, line.quantity - 1))}
                        disabled={line.quantity <= 1}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      >
                        −
                      </button>
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={line.quantity}
                        onChange={(event) => handleUpdateQuantity(line.cartItemId, Number(event.target.value) || 1)}
                        className="w-16 border-none bg-transparent text-center text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleUpdateQuantity(line.cartItemId, Math.min(99, line.quantity + 1))}
                        disabled={line.quantity >= 99}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-lg font-semibold text-zinc-700 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
                      >
                        +
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-500 hover:underline"
                      onClick={() => handleRemoveItem(line.cartItemId)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <aside className="h-fit rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="type-label">Summary</p>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Subtotal</span>
                <span>{formatInr(subtotal)}</span>
              </div>
              <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                <span>Shipping</span>
                <span>{shipping === 0 ? 'Free' : formatInr(shipping)}</span>
              </div>
              <div className="flex justify-between border-t border-zinc-200 pt-3 text-lg font-bold text-zinc-900 dark:border-zinc-800 dark:text-white">
                <span>Total</span>
                <span>{formatInr(subtotal + shipping)}</span>
              </div>
            </div>
            <Link to="/checkout" className="mt-6 block">
              <Button className="w-full" size="lg" type="button">
                Checkout
              </Button>
            </Link>
            <Link
              to="/shop"
              className="mt-3 block text-center text-sm font-semibold text-orange-600 dark:text-orange-400"
            >
              Continue shopping
            </Link>
          </aside>
        </div>
      )}
    </div>
  )
}
