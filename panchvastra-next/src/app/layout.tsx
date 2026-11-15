import type { Metadata, Viewport } from 'next'
import { Playfair_Display, Poppins } from 'next/font/google'
import { Providers } from '@/app/providers'
import { rootMetadata } from '@/lib/metadata'
import './globals.css'

/**
 * Root layout — a Server Component, which is the default and stays that way.
 *
 * Only `Providers` below is a Client Component, and it is deliberately the single
 * boundary: everything outside it can render on the server, which is what makes
 * server-rendered metadata and (from Phase 4) server-rendered catalogue pages possible.
 *
 * FONTS. The Vite app loads Poppins and Playfair Display with a `<link>` to
 * `fonts.googleapis.com` in `index.html`. `next/font/google` self-hosts both at build
 * time instead: no third-party request on page load, no render-blocking stylesheet, and
 * no layout shift from a late-arriving face. The weights requested are exactly the ones
 * that `<link>` asked for, so nothing renders in a weight it did not before.
 *
 * The two faces are exposed as CSS variables and consumed by `--font-sans` /
 * `--font-display` in `globals.css`, so every `font-sans` / `font-display` utility and
 * the `h1–h4` base rule keep working untouched.
 */

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
})

const playfairDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-playfair-display',
  display: 'swap',
})

export const metadata: Metadata = rootMetadata

/**
 * `viewport` is its own export in the App Router rather than a `<meta>` tag.
 * `width=device-width, initial-scale=1` matches the Vite `index.html` exactly.
 *
 * `colorScheme: 'light'` mirrors `color-scheme: light` in `globals.css`: the app has a
 * `dark:` variant defined but never applies `.dark`, so declaring light here stops the
 * browser from dark-rendering form controls and scrollbars against a cream page.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'light',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} ${playfairDisplay.variable}`}>
      {/*
        `bg-cream` / `text-espresso` are already applied to `body` by the `@layer base`
        rule in globals.css — exactly as in the Vite app — so no classes are repeated here.
      */}
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
