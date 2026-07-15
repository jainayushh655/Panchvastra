import { Link } from 'react-router-dom'

type BreadcrumbProps = {
  items: Array<{ label: string; to?: string }>
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="admin-breadcrumb" aria-label="Breadcrumb">
      {items.map((item, index) => (
        <span key={`${item.label}-${index}`} className="admin-breadcrumb__item">
          {item.to ? <Link to={item.to}>{item.label}</Link> : <span>{item.label}</span>}
          {index < items.length - 1 ? <span className="admin-breadcrumb__separator">/</span> : null}
        </span>
      ))}
    </nav>
  )
}
