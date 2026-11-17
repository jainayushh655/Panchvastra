import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedAdminRoute } from '@/admin/components/ProtectedAdminRoute'
import { AdminLayout } from '@/admin/layout/AdminLayout'
import { AdminAuthCarouselPage } from '@/admin/pages/AdminAuthCarouselPage'
import { AdminCustomOptionsPage } from '@/admin/pages/AdminCustomOptionsPage'
import { AdminCustomRequestsPage } from '@/admin/pages/AdminCustomRequestsPage'
import { AdminCategoriesPage } from '@/admin/pages/AdminCategoriesPage'
import { AdminSubCategoriesPage } from '@/admin/pages/AdminSubCategoriesPage'
import { AdminCouponsPage } from '@/admin/pages/AdminCouponsPage'
import { AdminDashboardPage } from '@/admin/pages/AdminDashboardPage'
import { AdminLoginPage } from '@/admin/pages/AdminLoginPage'
import { AdminHelpDeskPage } from '@/admin/pages/AdminHelpDeskPage'
import { AdminNotifyMePage } from '@/admin/pages/AdminNotifyMePage'
import { AdminOrderDetailPage } from '@/admin/pages/AdminOrderDetailPage'
import { AdminOrdersPage } from '@/admin/pages/AdminOrdersPage'
import { AdminProductsPage } from '@/admin/pages/AdminProductsPage'

export function AdminRoutes() {
  return (
    <Routes>

      <Route index element={<Navigate to="login" replace />} />

      <Route path="login" element={<AdminLoginPage />} />

      <Route element={<ProtectedAdminRoute />}>

        <Route element={<AdminLayout />}>

          <Route path="dashboard" element={<AdminDashboardPage />} />

          <Route path="orders" element={<AdminOrdersPage />} />

          {/* Order detail. Sits inside the same ProtectedAdminRoute as the list, so it
              is never reachable without an admin session. */}
          <Route path="orders/:orderId" element={<AdminOrderDetailPage />} />

          <Route path="products" element={<AdminProductsPage />} />

          <Route path="categories" element={<AdminCategoriesPage />} />

          <Route path="sub-categories" element={<AdminSubCategoriesPage />} />

          <Route path="coupons" element={<AdminCouponsPage />} />

          <Route path="notify-me" element={<AdminNotifyMePage />} />

          {/* Inside the same ProtectedAdminRoute as every other admin screen. */}
          <Route path="help-desk" element={<AdminHelpDeskPage />} />

          {/* Custom Piece. Inside the same ProtectedAdminRoute as every other admin
              screen, so neither is reachable without an admin session. */}
          <Route path="custom-options" element={<AdminCustomOptionsPage />} />
          <Route path="custom-requests" element={<AdminCustomRequestsPage />} />

          <Route path="auth-carousel" element={<AdminAuthCarouselPage />} />

          <Route path="*" element={<Navigate to="dashboard" replace />} />

        </Route>

      </Route>

    </Routes>
  )
}