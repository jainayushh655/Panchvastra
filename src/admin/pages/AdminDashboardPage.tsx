import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminPageCard } from '@/admin/components/AdminPageCard'
import { adminDashboardStats, adminRecentActivity } from '@/admin/services/adminData'

export function AdminDashboardPage() {
  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Admin Portal</p>
          <h2>Dashboard</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Dashboard' }]} />
      </div>

      <section className="admin-grid admin-grid--stats">
        {adminDashboardStats.map((item) => (
          <AdminPageCard key={item.title} title={item.title} value={item.value} accent={item.accent} />
        ))}
      </section>

      <section className="admin-grid admin-grid--content">
        <article className="admin-card admin-card--wide">
          <div className="admin-card__header">
            <h3>Recent Activity</h3>
            <span>Today</span>
          </div>
          <ul className="admin-list">
            {adminRecentActivity.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
                <span>{item.time}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  )
}
