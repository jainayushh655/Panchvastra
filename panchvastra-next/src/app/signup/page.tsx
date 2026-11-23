import type { Metadata } from 'next'
import { SignupView } from '@/components/auth/SignupView'
import { accountPageMetadata } from '@/lib/metadata'

/**
 * `/signup` — a Server Component shell around the registration screen.
 *
 * Outside the `(storefront)` route group, beside `/login` and for the same reason: the
 * Vite `/signup` route sits outside `<MainLayout>`, so the screen has no navbar and no
 * footer and its split-screen layout fills the viewport.
 *
 * Nothing is fetched here and nothing customer-specific exists until the form is filled
 * in, so the server-rendered HTML is the empty form and the brand poster — see the Phase
 * 4E-1 report for the check that confirms it.
 *
 * `noindex` is permanent: a registration form has nothing to offer a search result.
 * `follow` stays on so the links it carries are still discovered.
 */

export const metadata: Metadata = accountPageMetadata('Sign up')

export default function SignupPage() {
  return <SignupView />
}
