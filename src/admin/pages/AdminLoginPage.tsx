import { FormEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth } from '@/admin/hooks/useAdminAuth'

export function AdminLoginPage() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    try {
      login(email, password)
      navigate('/admin/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login__card">
        <div className="admin-login__brand">Panchvastra Admin</div>
        <h1>Welcome back</h1>
        <p>Securely manage your storefront catalog and promotions.</p>

        <form className="admin-login__form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@panchvastra.com" />
          </label>
          <label>
            <span>Password</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
          </label>
          {error ? <p className="admin-login__error">{error}</p> : null}
          <button type="submit">Sign In</button>
        </form>

        <button type="button" className="admin-login__ghost">Forgot Password</button>
      </div>
    </div>
  )
}
