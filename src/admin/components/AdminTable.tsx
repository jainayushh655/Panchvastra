type AdminTableProps<T> = {
  headers: string[]
  rows: T[]
  renderRow: (item: T) => React.ReactNode
  /** Stable identity for each row. Falls back to the array index when not supplied. */
  getRowKey?: (item: T, index: number) => string
}

export function AdminTable<T>({ headers, rows, renderRow, getRowKey }: AdminTableProps<T>) {
  return (
    <div className="admin-table-card">
      <table className="admin-table">
        <thead>
          <tr>
            {headers.map((header) => (
              <th key={header} scope="col">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={getRowKey ? getRowKey(row, index) : index}>{renderRow(row)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
