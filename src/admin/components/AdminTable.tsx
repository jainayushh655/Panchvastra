type AdminTableProps<T> = {
  headers: string[]
  rows: T[]
  renderRow: (item: T) => React.ReactNode
}

export function AdminTable<T>({ headers, rows, renderRow }: AdminTableProps<T>) {
  return (
    <div className="admin-table-card">
      <table className="admin-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map((row, index) => <tr key={index}>{renderRow(row)}</tr>)}</tbody>
      </table>
    </div>
  )
}
