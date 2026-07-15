import { useMemo, useState } from 'react'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { adminCategories } from '@/admin/services/adminData'

export function AdminCategoriesPage() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const filteredCategories = useMemo(() => {
    return adminCategories.filter((category) => category.name.toLowerCase().includes(query.toLowerCase()))
  }, [query])

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Catalog</p>
          <h2>Categories</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Categories' }]} />
      </div>

      <section className="admin-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search categories" />
        <button type="button">Add Category</button>
      </section>

      <AdminTable
        headers={['Name', 'Slug', 'Products', 'Status', 'Actions']}
        rows={filteredCategories.slice((page - 1) * 3, page * 3)}
        renderRow={(category) => (
          <>
            <td>{category.name}</td>
            <td>{category.slug}</td>
            <td>{category.products}</td>
            <td>{category.status}</td>
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
        <button type="button" disabled={page * 3 >= filteredCategories.length} onClick={() => setPage((current) => current + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}
