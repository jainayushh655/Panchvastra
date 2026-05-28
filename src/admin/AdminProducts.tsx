import { Link } from 'react-router-dom'
import { useCatalog } from '@/hooks/useCatalog'
import { deleteProductById } from '@/lib/catalogStore'
import { formatInr } from '@/lib/format'

export function AdminProducts() {
  const { products } = useCatalog()

  const remove = (id: string, name: string) => {
    if (!confirm(`Delete “${name}”?`)) return
    deleteProductById(id)
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="type-page-title text-white">Products</h1>
        <Link
          to="/admin/products/new"
          className="rounded-full bg-orange-500 px-5 py-2 text-sm font-bold text-zinc-950"
        >
          + New product
        </Link>
      </div>
      <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-zinc-900 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="p-4">Name</th>
              <th className="p-4">Slug</th>
              <th className="p-4">Category</th>
              <th className="p-4">Price</th>
              <th className="p-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 bg-zinc-950/80 text-zinc-300">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="p-4 font-semibold text-white">{p.name}</td>
                <td className="p-4 font-mono text-xs">{p.slug}</td>
                <td className="p-4">{p.categorySlug}</td>
                <td className="p-4">{formatInr(p.price)}</td>
                <td className="p-4 text-right">
                  <Link className="text-orange-400 hover:underline" to={`/admin/products/${p.id}`}>
                    Edit
                  </Link>
                  {' · '}
                  <button type="button" className="text-red-400 hover:underline" onClick={() => remove(p.id, p.name)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
