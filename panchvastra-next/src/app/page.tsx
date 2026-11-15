import Link from 'next/link'
import { BrandMark } from '@/components/BrandMark'

/**
 * Temporary migration landing page — a Server Component, with no client JavaScript.
 *
 * This is NOT the homepage. The real homepage (hero carousel, New Arrivals, category grid
 * and pills) is migrated in Phase 4, where it becomes a server shell that fetches
 * products and categories and hands them to a client island.
 *
 * Its only job in Phase 2 is to prove the foundation works end to end: the brand palette,
 * both self-hosted fonts, the typography component classes, the asset pipeline and the
 * metadata defaults. Everything on it is drawn from the ported theme — no new colour, no
 * new type scale, no inline hex.
 */
export default function MigrationLandingPage() {
  return (
    <main className="flex min-h-svh flex-col">
      {/* Chocolate bar, same surface treatment as the storefront header. */}
      <header className="border-b border-zinc-800 bg-chocolate">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3.5">
          <BrandMark />
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl text-center">
          <p className="type-eyebrow">Next.js Migration · Phase 2</p>

          <h1 className="type-hero-title mt-3">Foundation ready.</h1>

          <p className="type-body mx-auto mt-5 max-w-md">
            The Next.js App Router foundation for PANCHVASTRA is in place. The live
            storefront continues to run on the existing application — nothing customer
            facing has moved yet.
          </p>

          {/* Swatch strip: the approved palette, rendered from theme tokens only. */}
          <div className="mt-10">
            <p className="type-label">Theme</p>
            <div className="mt-3 flex justify-center gap-2">
              {[
                { name: 'Chocolate', className: 'bg-chocolate' },
                { name: 'Cream', className: 'bg-cream' },
                { name: 'Burgundy', className: 'bg-burgundy' },
                { name: 'Sand Beige', className: 'bg-sand' },
                { name: 'Espresso', className: 'bg-espresso' },
                { name: 'Soft Beige', className: 'bg-soft-beige' },
                { name: 'White', className: 'bg-paper' },
              ].map((swatch) => (
                <span
                  key={swatch.name}
                  title={swatch.name}
                  aria-label={swatch.name}
                  className={`size-9 rounded-md border border-sand ${swatch.className}`}
                />
              ))}
            </div>
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/migration-status"
              className="type-btn inline-flex min-h-[42px] cursor-pointer items-center justify-center rounded-md border border-chocolate bg-chocolate px-7 py-3 text-sm uppercase tracking-wide text-cream transition-all hover:bg-espresso active:scale-[0.98]"
            >
              Migration status
            </Link>
          </div>

          <p className="type-body-sm mt-12">
            Phase 3 migrates the shared layout and components.
          </p>
        </div>
      </div>
    </main>
  )
}
