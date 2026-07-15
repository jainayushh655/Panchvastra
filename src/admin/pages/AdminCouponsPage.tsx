import { useMemo, useState } from 'react'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { adminCoupons } from '@/admin/services/adminData'

export function AdminCouponsPage() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const filteredCoupons = useMemo(() => {
    return adminCoupons.filter((coupon) => coupon.code.toLowerCase().includes(query.toLowerCase()))
  }, [query])

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Marketing</p>
          <h2>Coupons</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Coupons' }]} />
      </div>

      <section className="admin-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search coupons" />
        <button type="button">Create Coupon</button>
      </section>

      <AdminTable
        headers={['Code', 'Discount', 'Expiry', 'Status', 'Actions']}
        rows={filteredCoupons.slice((page - 1) * 3, page * 3)}
        renderRow={(coupon) => (
          <>
            <td>{coupon.code}</td>
            <td>{coupon.discount}</td>
            <td>{coupon.expiry}</td>
            <td>{coupon.status}</td>
            <td>
              <button type="button" className="admin-link-button">Edit</button>
              <button type="button" className="admin-link-button admin-link-button--danger">Delete</button>
            </td>
          </>
        )}
      />

      <div className="admin-pagination">
        <button type="button" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
          Prev
        </button>
        <span>Page {page}</span>
        <button type="button" disabled={page * 3 >= filteredCoupons.length} onClick={() => setPage((current) => current + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}
