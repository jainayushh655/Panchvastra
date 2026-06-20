import type { FormEvent } from 'react'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useDocumentTitle } from '@/hooks/useDocumentTitle'
import { validateEmail, validatePasswordLogin } from '@/lib/formValidation'
import { loginUser } from '@/lib/userAuth'

export function LoginPage() {
  useDocumentTitle('Login')
  const navigate = useNavigate()
  const location = useLocation()
  const nextPath =
    typeof (location.state as { from?: unknown } | null)?.from === 'string'
      ? ((location.state as { from: string }).from || '/')
      : '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const inputClass =
    'w-full rounded-xl border border-[#dcc59b] bg-white/95 px-3 py-2.5 text-sm text-zinc-900 outline-none transition-colors focus:border-[#b07f2e]'

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const emailErr = validateEmail(email)
    if (emailErr) {
      setError(emailErr)
      return
    }

    const passwordErr = validatePasswordLogin(password)
    if (passwordErr) {
      setError(passwordErr)
      return
    }

    const result = loginUser({ email, password })
    if (!result.ok) {
      setError(result.error)
      return
    }

    navigate(nextPath, { replace: true })
  }

  return (
    <div className="min-h-svh bg-[radial-gradient(circle_at_top,rgba(214,179,109,0.24),transparent_40%),linear-gradient(180deg,#fff8eb,#fffdf8)] px-4 py-14">
      <div className="mx-auto w-full max-w-md rounded-3xl border border-[#e5cfaa] bg-white/90 p-7 shadow-[0_30px_60px_-36px_rgba(0,0,0,0.4)] backdrop-blur">
        <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-[#8a7355]">Welcome back</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#b07f2e]">Login</h1>
        <p className="mt-2 text-sm text-zinc-600">Sign in to continue shopping your saved picks.</p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a7355]">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className={`${inputClass} mt-1`}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setError('')
              }}
            />
          </div>

          <div>
            <label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-[0.16em] text-[#8a7355]">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              className={`${inputClass} mt-1`}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError('')
              }}
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button
            type="submit"
            size="lg"
            className="w-full !border-[#b07f2e] !bg-[#b07f2e] !text-white hover:!bg-[#99661f]"
          >
            Login
          </Button>
        </form>

        <p className="mt-6 text-sm text-zinc-600">
          New here?{' '}
          <Link to="/signup" className="font-semibold text-[#8a7355] hover:text-[#b07f2e]">
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
