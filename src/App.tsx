import { Fragment, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { hydrateCatalogFromApi, syncCatalogFromLocalStorage } from '@/lib/catalogStore'
import { AdminCategories } from '@/admin/AdminCategories'
import { AdminDashboard } from '@/admin/AdminDashboard'
import { AdminHomepage } from '@/admin/AdminHomepage'
import { AdminLayout } from '@/admin/AdminLayout'
import { AdminLoginPage } from '@/admin/AdminLoginPage'
import { AdminOrders } from '@/admin/AdminOrders'
import { AdminProductEdit } from '@/admin/AdminProductEdit'
import { AdminProducts } from '@/admin/AdminProducts'
import { RequireAdmin } from '@/admin/RequireAdmin'
import { MainLayout } from '@/components/layout/MainLayout'
import { AboutPage } from '@/pages/AboutPage'
import { CartPage } from '@/pages/CartPage'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { ContactPage } from '@/pages/ContactPage'
import { HomePage } from '@/pages/HomePage'
import { ProductDetailPage } from '@/pages/ProductDetailPage'
import { ShopPage } from '@/pages/ShopPage'
function CatalogBootstrap() {
  useEffect(() => {
    syncCatalogFromLocalStorage()
    void hydrateCatalogFromApi()
  }, [])
  return null
}

export default function App() {
  return (
    <Fragment>
      <CatalogBootstrap />
      <Routes>
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route element={<RequireAdmin />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="products/:id" element={<AdminProductEdit />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="homepage" element={<AdminHomepage />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Route>
      <Route element={<MainLayout />}>
        <Route index element={<HomePage />} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="product/:slug" element={<ProductDetailPage />} />
        <Route path="cart" element={<CartPage />} />
        <Route path="checkout" element={<CheckoutPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
    </Fragment>
  )
}
