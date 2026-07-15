import { Fragment } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { MainLayout } from '@/components/layout/MainLayout'
import { AboutPage } from '@/pages/AboutPage'
import { CartPage } from '@/pages/CartPage'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { ContactPage } from '@/pages/ContactPage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { ProductDetailPage } from '@/pages/ProductDetailPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { ShopPage } from '@/pages/ShopPage'
import { SignupPage } from '@/pages/SignupPage'
import { OrdersPage } from '@/pages/OrdersPage'
import { AdminApp } from '@/admin'

export default function App() {
  return (
    <Fragment>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<MainLayout />}>
          <Route index element={<HomePage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="product/:id" element={<ProductDetailPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Fragment>
  )
}
