import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function OrdersPage() {
  useDocumentTitle('My Orders')

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="border border-zinc-200 bg-white p-7 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.15)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-zinc-500">Orders</p>
        <h1 className="mt-2 text-3xl font-bold uppercase tracking-tight text-black">My Orders</h1>
        <p className="mt-2 text-sm text-zinc-600">Your recent orders will appear here once placed.</p>

        <div className="mt-6 border border-zinc-200 bg-[#f7f7f5] p-6 text-sm text-zinc-600">
          You haven’t placed any orders yet. Start shopping to see your order history here.
        </div>

        <div className="mt-6">
          <Link to="/shop" className="border border-black bg-black px-4 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-zinc-800">
            Browse Products
          </Link>
        </div>
      </div>
    </div>
  )
}
