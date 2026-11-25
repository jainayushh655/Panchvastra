/**
 * The admin sidebar's navigation, in the Vite order.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY EVERY ITEM IS LISTED, BUT ONLY SOME ARE LINKS
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite sidebar has eleven sections. In this application exactly one of them exists so
 * far — the dashboard — because the eleven management screens are later phases.
 *
 * Two bad options were available. Rendering all eleven as links would produce ten
 * navigation items that look live and 404, which is worse than not showing them.
 * Rendering only the dashboard would hide the shape of the panel and make the shell
 * impossible to review against the original.
 *
 * So each entry carries `ready`. A ready item is a real link with a real active state; the
 * rest render as plainly disabled, marked "Soon", `aria-disabled` and non-focusable — they
 * document what is coming without pretending to work. Flipping one to `ready: true` is the
 * single line a later phase changes when it lands that screen.
 */

export type AdminNavItem = {
  href: string
  label: string
  /** True once the route actually exists. Only a ready item is rendered as a link. */
  ready: boolean
}

export const ADMIN_NAV: AdminNavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', ready: true },
  { href: '/admin/orders', label: 'Orders', ready: false },
  { href: '/admin/products', label: 'Products', ready: false },
  { href: '/admin/categories', label: 'Categories', ready: false },
  { href: '/admin/sub-categories', label: 'Sub-Categories', ready: false },
  { href: '/admin/coupons', label: 'Coupons', ready: false },
  { href: '/admin/notify-me', label: 'Notify Me', ready: false },
  { href: '/admin/help-desk', label: 'Help Desk', ready: false },
  { href: '/admin/custom-options', label: 'Custom Options', ready: false },
  { href: '/admin/custom-requests', label: 'Custom Requests', ready: false },
  { href: '/admin/auth-carousel', label: 'Auth Carousel', ready: false },
]

/**
 * True when `pathname` is inside `href`.
 *
 * Replaces react-router's `NavLink isActive`. The segment-boundary check is the point:
 * a plain `startsWith` would light up "Orders" for a future `/admin/orders-archive`, and
 * the prefix form is still needed so a detail route like `/admin/orders/42` keeps its
 * parent section active — which is what `NavLink` did by default.
 */
export function isAdminNavActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
