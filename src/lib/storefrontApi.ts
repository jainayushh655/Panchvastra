/** Same-origin `/api` in dev (Vite proxy), or `VITE_API_URL` in production. */
export function storefrontApiPath(path: string): string {
  const base = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}
