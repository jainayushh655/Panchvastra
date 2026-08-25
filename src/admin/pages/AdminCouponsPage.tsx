import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminErrorState } from '@/admin/components/AdminStates'

/**
 * The coupon endpoint (`/v1/coupon_management/`) exists on the backend but rejects every
 * request from this panel with `401 Authorization token missing`, and its request/response
 * contract could not be verified without valid admin credentials.
 *
 * This page previously rendered hardcoded placeholder coupons (WELCOME10 / SUMMER20 /
 * FESTIVE15) that were never fetched from anywhere. Showing invented promotions in an
 * admin tool is worse than showing nothing, so the real integration status is surfaced
 * instead. Wire this up once the endpoint contract and admin auth are available.
 */
export function AdminCouponsPage() {
  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Marketing</p>
          <h2>Coupons</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Coupons' }]} />
      </div>

      <AdminErrorState
        title="Coupons are not connected"
        message="The coupon service requires an authenticated admin session that this panel cannot yet obtain, so no coupon data can be shown. Previously this page displayed placeholder coupons that did not exist in the backend; they have been removed to avoid acting on fictional promotions."
      />
    </div>
  )
}
