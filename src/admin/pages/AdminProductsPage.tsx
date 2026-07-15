import { useMemo, useState } from 'react'
import { Breadcrumb } from '@/admin/components/Breadcrumb'
import { AdminTable } from '@/admin/components/AdminTable'
import { adminProducts } from '@/admin/services/adminData'

export function AdminProductsPage() {
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const filteredProducts = useMemo(() => {
    return adminProducts.filter((product) => product.name.toLowerCase().includes(query.toLowerCase()))
  }, [query])

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <div>
          <p className="admin-page__eyebrow">Catalog</p>
          <h2>Products</h2>
        </div>
        <Breadcrumb items={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Products' }]} />
      </div>

      <section className="admin-toolbar">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products" />
        <button type="button">Add Product</button>
      </section>

      <AdminTable
        headers={['Product', 'Category', 'Price', 'Stock', 'Status', 'Actions']}
        rows={filteredProducts.slice((page - 1) * 3, page * 3)}
        renderRow={(product) => (
          <>
            <td>{product.name}</td>
            <td>{product.category}</td>
            <td>₹{product.price}</td>
            <td>{product.stock}</td>
            <td>{product.status}</td>
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
        <button type="button" disabled={page * 3 >= filteredProducts.length} onClick={() => setPage((current) => current + 1)}>
          Next
        </button>
      </div>
    </div>
  )
}
