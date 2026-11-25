import type { ReactNode } from 'react'

/**
 * Admin table — ported from the Vite `src/admin/components/AdminTable.tsx`, unchanged.
 *
 * Same `admin-table-card` / `admin-table` markup, same `scope="col"` headers, same
 * `getRowKey` fallback to the array index. No state, so it stays a Server Component; the
 * screens that use it pass their own cells.
 *
 * It is migrated now, ahead of the screens that need it, because it is genuinely shared —
 * eight of the eleven management screens render a list through it — and because a later
 * phase should not have to review the shell and a table at the same time.
 */
export function AdminTable<T>({
  headers,
  rows,
  renderRow,
  getRowKey,
}: {
  headers: string[]
  rows: T[]
  renderRow: (item: T) => ReactNode
  /** Stable identity for each row. Falls back to the array index when not supplied. */
  getRowKey?: (item: T, index: number) => string
}) {
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
