import { createElement } from 'react'
import './styles/admin.css'
import { AdminAuthProvider } from './context/AdminAuthProvider'
import { AdminRoutes } from './routes/AdminRoutes'

export function AdminApp() {
  return createElement(AdminAuthProvider, null, createElement(AdminRoutes))
}
    