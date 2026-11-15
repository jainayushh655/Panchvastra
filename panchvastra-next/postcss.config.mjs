/**
 * Tailwind CSS 4 via PostCSS.
 *
 * The Vite application uses `@tailwindcss/vite`, which is a Vite-only plugin. Next's CSS
 * pipeline is PostCSS, so the same Tailwind version is wired through
 * `@tailwindcss/postcss` instead. This is the ONLY Tailwind-related change in the
 * migration: there is no `tailwind.config.js` in either application, because v4 is
 * configured in CSS — the brand palette, the re-anchored neutral ramp, the fonts and the
 * type scale all live in the `@theme` block in `src/app/globals.css`.
 *
 * No `autoprefixer` entry: Tailwind 4 handles vendor prefixing itself, and adding it
 * alongside is redundant work on every build.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
