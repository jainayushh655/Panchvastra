import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { validateAdmin, setAdminSession } from '@/lib/adminAuth'

export function AdminLoginPage() {
  const navigate = useNavigate()
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!validateAdmin(pin)) {
      setErr('Invalid token. Default demo: pv-admin-demo or VITE_ADMIN_TOKEN')
      return
    }
    setAdminSession()
    navigate('/admin', { replace: true })
  }

  const inp =
    'w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-400'

  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-950 px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/70 p-8">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-orange-400">CMS</p>
        <h1 className="type-page-title mt-2">PANCHVASTRA Admin</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Enter password to access the admin dashboard.
          {/* Enter API token (env <code className="text-orange-300">VITE_ADMIN_TOKEN</code>). */}
          {/* <code className="text-orange-300">pv-admin-demo</code>. */}
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <input
            className={inp}
            type="password"
            autoComplete="current-password"
            placeholder="Admin token"
            value={pin}
            onChange={(e) => {
              setErr('')
              setPin(e.target.value)
            }}
          />
          {err ? <p className="text-sm text-red-400">{err}</p> : null}
          <Button type="submit" size="lg" className="w-full">
            Unlock
          </Button>
        </form>
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-zinc-500 hover:text-orange-400">
          ← Storefront
        </Link>
      </div>
    </div>
  )
}
