import path from 'node:path'

function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV)
}

/** Local dev: `server/data/orders.csv`. On Vercel: `/tmp/orders.csv` only (project disk is read-only). */
export function ordersCsvPath(): string {
  if (isVercelRuntime()) return '/tmp/orders.csv'

  const fromEnv = process.env.ORDERS_CSV_PATH?.trim()
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.join(process.cwd(), fromEnv)
  }
  return path.join(process.cwd(), 'server', 'data', 'orders.csv')
}
