import { Fragment, Suspense, lazy, useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { MainLayout } from '@/components/layout/MainLayout'
import { RouteFallback } from '@/components/layout/RouteFallback'
import { HomePage } from '@/pages/HomePage'

/*
 * ──────────────────────────────────────────────────────────────────────────────
 * ROUTE-LEVEL CODE SPLITTING
 * ──────────────────────────────────────────────────────────────────────────────
 * Every customer page used to be a static import, so the first visit downloaded all of
 * them before anything could render — the 1,000-line Custom Piece builder, the whole
 * checkout, the orders screen, the help desk — for someone who had only opened the
 * homepage. That one bundle was ~750 kB.
 *
 * Each page below is now its own chunk, fetched when its route is first opened and cached
 * by the browser from then on.
 *
 * `HomePage` is deliberately NOT lazy. It is the most common landing page, and splitting
 * it would put a second network round trip between the JavaScript arriving and the first
 * paint — paying latency exactly where it is most visible. It is also small.
 *
 * The policy pages are grouped into ONE chunk rather than three. They are tiny, almost
 * never visited, and three separate requests for a few kilobytes each is worse than one.
 */

const ShopPage = lazy(() => import('@/pages/ShopPage').then((m) => ({ default: m.ShopPage })))
const ProductDetailPage = lazy(() =>
  import('@/pages/ProductDetailPage').then((m) => ({ default: m.ProductDetailPage })),
)
const AboutPage = lazy(() => import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })))
const HelpDeskPage = lazy(() => import('@/pages/HelpDeskPage').then((m) => ({ default: m.HelpDeskPage })))
const CustomPiecePage = lazy(() =>
  import('@/pages/CustomPiecePage').then((m) => ({ default: m.CustomPiecePage })),
)

const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const SignupPage = lazy(() => import('@/pages/SignupPage').then((m) => ({ default: m.SignupPage })))

const CartPage = lazy(() => import('@/pages/CartPage').then((m) => ({ default: m.CartPage })))
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage').then((m) => ({ default: m.CheckoutPage })))
const ProfilePage = lazy(() => import('@/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const OrdersPage = lazy(() => import('@/pages/OrdersPage').then((m) => ({ default: m.OrdersPage })))
const WishlistPage = lazy(() => import('@/pages/WishlistPage').then((m) => ({ default: m.WishlistPage })))

/* The three policy pages share one chunk — see the note above. */
const RefundPolicyPage = lazy(() =>
  import('@/pages/policies').then((m) => ({ default: m.RefundPolicyPage })),
)
const PrivacyPolicyPage = lazy(() =>
  import('@/pages/policies').then((m) => ({ default: m.PrivacyPolicyPage })),
)
const TermsOfServicePage = lazy(() =>
  import('@/pages/policies').then((m) => ({ default: m.TermsOfServicePage })),
)

/*
 * The admin panel is the largest area of the app and no shopper ever loads it, so it is
 * split out of the customer bundle and fetched only when an `/admin/*` route is opened.
 * The entry also imports `admin.css`, which leaves the customer stylesheet along with it.
 */
const AdminApp = lazy(() => import('@/admin').then((m) => ({ default: m.AdminApp })))

/*
 * ──────────────────────────────────────────────────────────────────────────────
 * WARMING THE TWO ROUTES EVERY SHOPPER TAKES NEXT
 * ──────────────────────────────────────────────────────────────────────────────
 * Code splitting moved those chunks off the first load, which is the right trade — but it
 * moved the download to the worst possible moment: the tap. A shopper who taps a product
 * card then waits for `ProductDetailPage` to arrive before anything happens, and on a slow
 * mobile connection that is a second of a page that looks broken.
 *
 * Fetching them while the browser is IDLE gets both: the first paint is not delayed, and
 * by the time anyone has read the hero and scrolled to a product the chunk is already in
 * the cache, so the navigation is instant.
 *
 * Only Shop and the product page are warmed. They are where essentially all homepage
 * traffic goes; speculatively downloading checkout, the profile or the 30 kB custom-piece
 * builder for someone who is still looking at the hero would be spending a mobile
 * visitor's data on a guess.
 *
 * `requestIdleCallback` means this never competes with the page's own work — and it is
 * skipped entirely on a metered or 2G connection, where an unrequested download is a real
 * cost to the visitor. Safari has neither API, hence both fallbacks.
 */
function usePrefetchLikelyRoutes() {
  useEffect(() => {
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string }
    }).connection

    if (connection?.saveData) return
    if (connection?.effectiveType && /2g/.test(connection.effectiveType)) return

    const warm = () => {
      void import('@/pages/ShopPage')
      void import('@/pages/ProductDetailPage')
    }

    const idle = window.requestIdleCallback
    if (typeof idle === 'function') {
      const handle = idle(warm, { timeout: 3000 })
      return () => window.cancelIdleCallback?.(handle)
    }

    // Safari: a plain timeout, long enough to be clear of the first paint.
    const timer = window.setTimeout(warm, 2000)
    return () => window.clearTimeout(timer)
  }, [])
}

export default function App() {
  usePrefetchLikelyRoutes()

  return (
    <Fragment>
      <Routes>
        {/*
          Auth screens sit outside MainLayout and so outside its Suspense boundary, which
          is why they carry their own. Without it a lazy login page would suspend with no
          boundary above it and blank the app.
        */}
        <Route
          path="/login"
          element={(
            <Suspense fallback={<RouteFallback />}>
              <LoginPage />
            </Suspense>
          )}
        />
        <Route
          path="/signup"
          element={(
            <Suspense fallback={<RouteFallback />}>
              <SignupPage />
            </Suspense>
          )}
        />

        {/* MainLayout wraps its own <Outlet /> in Suspense, so the navbar and footer stay
            painted while a page chunk loads instead of the whole screen going blank. */}
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

        {/* Suspense is scoped to this one route, so nothing on a customer route can be
            held up by it. The fallback is deliberately blank: the admin shell paints its
            own chrome, and a spinner here would flash on every admin navigation. */}
        <Route
          path="/admin/*"
          element={(
            <Suspense fallback={null}>
              <AdminApp />
            </Suspense>
          )}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Fragment>
  )
}
