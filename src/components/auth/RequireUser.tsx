import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { getCurrentUser } from '@/lib/userAuth'

export function RequireUser() {
  const location = useLocation()
  const user = getCurrentUser()

  if (!user) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }

  return <Outlet />
}
