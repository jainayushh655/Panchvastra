import path from 'node:path'

/** Local dev: `server/data/orders.csv`. On Vercel: `/tmp/orders.csv` (writable; not durable across deploys). */
export function ordersCsvPath(): string {
  const fromEnv = process.env.ORDERS_CSV_PATH?.trim()
  if (fromEnv) {
    if (path.isAbsolute(fromEnv)) return fromEnv
    if (process.env.VERCEL) return path.join('/tmp', path.basename(fromEnv))
    return path.join(process.cwd(), fromEnv)
  }
  if (process.env.VERCEL) return '/tmp/orders.csv'
  return path.join(process.cwd(), 'server', 'data', 'orders.csv')
}
