import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'

export function OrdersPage() {
  useDocumentTitle('My Orders')

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="rounded-3xl border border-[#e5cfaa] bg-white/90 p-7 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.35)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8a7355]">Orders</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#b07f2e]">My Orders</h1>
        <p className="mt-2 text-sm text-zinc-600">Your recent orders will appear here once placed.</p>

        <div className="mt-6 rounded-2xl border border-[#e6d7bb] bg-[#fff8eb] p-6 text-sm text-zinc-600">
          You haven’t placed any orders yet. Start shopping to see your order history here.
        </div>

        <div className="mt-6">
          <Link to="/shop" className="rounded-full border border-[#e0c99f] bg-[#b07f2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#99661f]">
            Browse Products
          </Link>
        </div>
      </div>
    </div>
  )
}
