import { Link } from 'react-router-dom'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminErrorState, AdminLoadingState } from '@/admin/components/AdminStates'
import { useAdminCategories, useAdminProducts } from '@/admin/hooks/useAdminCatalog'
import { formatCurrency } from '@/admin/utils/formatters'

function StatCard({
  title,
  value,
  hint,
  to,
  linkLabel,
}: {
  title: string
  value: string
  hint?: string
  to?: string
  linkLabel?: string
}) {
  return (
    <article className="admin-card">
      <p className="admin-card__title">{title}</p>
      <h3 className="admin-card__value">{value}</h3>
      {hint ? <p className="admin-card__hint">{hint}</p> : null}
      {to && linkLabel ? (
        <Link className="admin-card__link" to={to}>
          {linkLabel} →
        </Link>
      ) : null}
    </article>
  )
}

export function AdminDashboardPage() {
  const products = useAdminProducts()
  const categories = useAdminCategories()

  const loading = products.loading || categories.loading
  const error = products.error ?? categories.error

  // Derived strictly from the live catalog response — no placeholder figures.
  const newArrivals = products.data.filter((p) => p.is_new_arrival).length
  const featured = products.data.filter((p) => p.is_featured).length
  const activeCategories = categories.data.filter((c) => c.is_active !== false).length
  const inventoryValue = products.data.reduce((sum, p) => sum + (p.selling_price ?? 0), 0)

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Admin Portal</p>
          <h2>Dashboard</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Dashboard' }]} />
      </div>

      {loading ? (
        <AdminLoadingState rows={4} />
      ) : error ? (
        <AdminErrorState
          title="Unable to load dashboard"
          message={error}
          onRetry={() => {
            products.reload()
            categories.reload()
          }}
        />
      ) : (
        <>
          <section className="admin-grid admin-grid--stats">
            <StatCard
              title="Total Products"
              value={String(products.data.length)}
              to="/admin/products"
              linkLabel="View products"
            />
            <StatCard
              title="Total Categories"
              value={String(categories.data.length)}
              hint={`${activeCategories} active`}
              to="/admin/categories"
              linkLabel="View categories"
            />
            <StatCard title="New Arrivals" value={String(newArrivals)} hint="Flagged is_new_arrival" />
            <StatCard title="Featured" value={String(featured)} hint="Flagged is_featured" />
            <StatCard
              title="Catalog Value"
              value={formatCurrency(inventoryValue)}
              hint="Sum of listed selling prices"
            />
          </section>

          <section className="admin-grid">
            <article className="admin-card admin-card--wide">
              <div className="admin-card__header">
                <h3>Data Sources</h3>
                <span>Live</span>
              </div>
              <ul className="admin-list">
                <li>
                  <strong>Products &amp; Categories</strong>
                  <p>Live from the storefront catalog API.</p>
                  <span>Connected</span>
                </li>
                <li>
                  <strong>Orders &amp; Revenue</strong>
                  <p>
                    Not shown: no admin-readable orders endpoint is wired into this panel yet, so
                    revenue and order counts cannot be reported accurately.
                  </p>
                  <span>Not connected</span>
                </li>
                <li>
                  <strong>Coupons</strong>
                  <p>The coupon endpoint requires admin authentication that is not configured.</p>
                  <span>Not connected</span>
                </li>
              </ul>
            </article>
          </section>
        </>
      )}
    </div>
  )
}
