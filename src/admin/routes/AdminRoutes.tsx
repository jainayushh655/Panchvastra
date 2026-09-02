import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedAdminRoute } from '@/admin/components/ProtectedAdminRoute'
import { AdminLayout } from '@/admin/layout/AdminLayout'
import { AdminCategoriesPage } from '@/admin/pages/AdminCategoriesPage'
import { AdminSubCategoriesPage } from '@/admin/pages/AdminSubCategoriesPage'
import { AdminCouponsPage } from '@/admin/pages/AdminCouponsPage'
import { AdminDashboardPage } from '@/admin/pages/AdminDashboardPage'
import { AdminLoginPage } from '@/admin/pages/AdminLoginPage'
import { AdminProductsPage } from '@/admin/pages/AdminProductsPage'

export function AdminRoutes() {
  return (
    <Routes>

      <Route index element={<Navigate to="login" replace />} />

      <Route path="login" element={<AdminLoginPage />} />

      <Route element={<ProtectedAdminRoute />}>

        <Route element={<AdminLayout />}>

          <Route path="dashboard" element={<AdminDashboardPage />} />

          <Route path="products" element={<AdminProductsPage />} />

          <Route path="categories" element={<AdminCategoriesPage />} />

          <Route path="sub-categories" element={<AdminSubCategoriesPage />} />

          <Route path="coupons" element={<AdminCouponsPage />} />

          <Route path="*" element={<Navigate to="dashboard" replace />} />

        </Route>

      </Route>

    </Routes>
  )
}