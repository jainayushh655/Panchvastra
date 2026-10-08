import { Fragment } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { MainLayout } from '@/components/layout/MainLayout'
import { AboutPage } from '@/pages/AboutPage'
import { CartPage } from '@/pages/CartPage'
import { CheckoutPage } from '@/pages/CheckoutPage'
import { HelpDeskPage } from '@/pages/HelpDeskPage'
import { CustomPiecePage } from '@/pages/CustomPiecePage'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { ProductDetailPage } from '@/pages/ProductDetailPage'
import { ProfilePage } from '@/pages/ProfilePage'
import { ShopPage } from '@/pages/ShopPage'
import { SignupPage } from '@/pages/SignupPage'
import { OrdersPage } from '@/pages/OrdersPage'
import { WishlistPage } from '@/pages/WishlistPage'
import { AdminApp } from '@/admin'
import { RefundPolicyPage } from '@/pages/policies/RefundPolicyPage'
import { PrivacyPolicyPage } from '@/pages/policies/PrivacyPolicyPage'
import { TermsOfServicePage } from '@/pages/policies/TermsOfServicePage'

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
          {/* The Help Desk replaces the old mock Contact page, and `/help-desk` is now the
              path every link in the app points at. `/contact` stays mapped to the same page
              so bookmarks, old links and anything already indexed keep working. */}
          <Route path="help-desk" element={<HelpDeskPage />} />
          <Route path="contact" element={<HelpDeskPage />} />

          {/* Public: the builder can be explored signed out. Only the SUBMIT needs a
              session, which the page handles with the app's own login redirect. */}
          <Route path="custom-piece" element={<CustomPiecePage />} />

          {/* Legal / policy pages — public, inside the shared layout. */}
          <Route path="policies/refund-policy" element={<RefundPolicyPage />} />
          <Route path="policies/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="policies/terms-of-service" element={<TermsOfServicePage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="wishlist" element={<WishlistPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Route>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Fragment>
  )
}
