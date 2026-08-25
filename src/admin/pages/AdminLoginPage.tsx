import { type FormEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '@/admin/hooks/useAdminAuth'

export function AdminLoginPage() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  /**
   * Synchronous duplicate-submit guard. `submitting` state alone is not enough: two clicks
   * dispatched in the same tick both read the pre-update value and each fire a request.
   */
  const inFlight = useRef(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (inFlight.current) return
    inFlight.current = true

    setError('')
    setSubmitting(true)

    try {
      const failure = await login(email, password)

      if (failure) {
        setError(failure)
        return
      }

      navigate('/admin/dashboard', { replace: true })
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <div className="admin-login__brand">Panchvastra Admin</div>
        <h1>Welcome back</h1>
        <p>Securely manage your storefront catalog.</p>

        <form className="admin-login__form" onSubmit={handleSubmit} noValidate>
          <label htmlFor="admin-email">
            <span>Email</span>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@panchvastra.com"
              disabled={submitting}
            />
          </label>
          <label htmlFor="admin-password">
            <span>Password</span>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              disabled={submitting}
            />
          </label>
          {error ? (
            <p className="admin-login__error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={submitting}>
            {submitting ? 'Logging in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
