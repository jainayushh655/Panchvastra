import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useCart } from '@/context/CartProvider'
import { formatInr } from '@/lib/format'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function CartPage() {
  useDocumentTitle('Cart')
  const { items, setQty, removeItem, subtotal } = useCart()

  const shipping = subtotal > 0 ? (subtotal >= 499 ? 0 : 99) : 0

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
              <li key={line.key} className="flex gap-4 py-6">
                <Link to={`/product/${line.slug}`} className="shrink-0">
                  <img
                    src={line.image}
                    alt=""
                    className="h-28 w-24 rounded-2xl object-cover"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/product/${line.slug}`}
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
                    <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                      Qty
                      <input
                        type="number"
                        min={1}
                        max={99}
                        value={line.quantity}
                        onChange={(e) => setQty(line.key, Number(e.target.value) || 1)}
                        className="w-16 rounded-lg border border-zinc-200 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                      />
                    </label>
                    <button
                      type="button"
                      className="text-xs font-semibold text-red-500 hover:underline"
                      onClick={() => removeItem(line.key)}
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
