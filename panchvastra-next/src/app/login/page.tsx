import type { Metadata } from 'next'
import { LoginView } from '@/components/auth/LoginView'
import { accountPageMetadata } from '@/lib/metadata'

/**
 * `/login` — a Server Component shell around the sign-in screen.
 *
 * NOT inside the `(storefront)` route group, which mirrors the Vite routing exactly: the
 * Vite `/login` and `/signup` routes sit OUTSIDE `<MainLayout>`, so the sign-in screen has
 * no navbar and no footer. Its own split-screen layout fills the viewport instead, and a
 * customer part-way through signing in is not offered the cart and account controls they
 * cannot use yet.
 *
 * `noindex` is permanent here, not a migration setting: a sign-in form has nothing to
 * offer a search result. `follow` stays on so the storefront links it does carry are
 * still discovered.
 */

export const metadata: Metadata = accountPageMetadata('Login')

export default function LoginPage() {
  return <LoginView />
}
