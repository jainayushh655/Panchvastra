import Link from 'next/link'

/**
 * Admin breadcrumb — ported from the Vite `src/admin/components/Breadcrumb.tsx`.
 *
 * Same classes (`admin-breadcrumb`, `__item`, `__separator`), same `aria-label`, same
 * "last item is plain text" rule. `react-router`'s `Link to=` becomes `next/link`
 * `href=`; the component holds no state, so it stays a Server Component and ships no
 * JavaScript.
 *
 * Renamed from `Breadcrumb` to `AdminBreadcrumb` to match the brief and to stop it being
 * mistaken for a storefront component — nothing on the storefront uses it.
 */
export function AdminBreadcrumb({ items }: { items: Array<{ label: string; href?: string }> }) {
  return (
    <nav className="admin-breadcrumb" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="admin-breadcrumb__item">
          {item.href ? <Link href={item.href}>{item.label}</Link> : <span>{item.label}</span>}
          {index < items.length - 1 ? <span className="admin-breadcrumb__separator">/</span> : null}
        </span>
      ))}
    </nav>
  )
}
