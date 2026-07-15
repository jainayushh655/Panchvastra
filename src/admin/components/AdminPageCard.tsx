type AdminPageCardProps = {
  title: string
  value: string
  accent: string
}

export function AdminPageCard({ title, value, accent }: AdminPageCardProps) {
  return (
    <article className={`admin-card ${accent}`}>
      <p className="admin-card__title">{title}</p>
      <h3 className="admin-card__value">{value}</h3>
    </article>
  )
}
