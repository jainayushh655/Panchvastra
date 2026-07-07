import { Link } from 'react-router-dom'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { getCurrentUser } from '@/lib/userAuth'

export function ProfilePage() {
  useDocumentTitle('My Profile')
  const user = getCurrentUser()

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col gap-6 px-4 py-10">
      <div className="rounded-3xl border border-[#e5cfaa] bg-white/90 p-7 shadow-[0_24px_60px_-36px_rgba(0,0,0,0.35)]">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8a7355]">Account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#b07f2e]">My Profile</h1>
        <p className="mt-2 text-sm text-zinc-600">Manage your account details and continue shopping.</p>

        <div className="mt-6 rounded-2xl border border-[#e6d7bb] bg-[#fff8eb] p-5">
          <p className="text-sm font-semibold text-zinc-800">Signed in as</p>
          <p className="mt-2 text-lg font-semibold text-[#8a7355]">{user?.email ?? 'Guest'}</p>
          <p className="mt-1 text-sm text-zinc-600">{user?.name ? `Name: ${user.name}` : 'Complete your account details to personalize your experience.'}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link to="/orders" className="rounded-full border border-[#e0c99f] bg-[#b07f2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#99661f]">
            View Orders
          </Link>
          <Link to="/shop" className="rounded-full border border-[#e0c99f] bg-white px-4 py-2 text-sm font-semibold text-[#8a7355] hover:bg-[#f7ebd4]">
            Continue Shopping
          </Link>
        </div>
      </div>
    </div>
  )
}
