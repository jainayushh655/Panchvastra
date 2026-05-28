import { Navigate, Outlet } from 'react-router-dom'
import { adminSessionOk } from '@/lib/adminAuth'

export function RequireAdmin() {
  if (!adminSessionOk()) return <Navigate to="/admin/login" replace />
  return <Outlet />
}
