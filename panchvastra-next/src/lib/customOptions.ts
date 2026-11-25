import type { CustomOptionsDto } from '@/types/api/CustomPieceDto'

/**
 * Normalising `GET /v1/custom_options/` into the four option lists.
 *
 * This lives in `lib/` rather than beside either caller because BOTH read the endpoint:
 * the Custom Piece page reads it on the server (`services/server/catalog.ts`) and the
 * builder island re-reads it from the browser when the server handed it nothing
 * (`services/customRequests.ts`). The server module imports `lib/env.server`, which fails
 * loudly if it is ever pulled into a client bundle, so the shared piece has to be a
 * dependency-free module the client can import safely. It is pure, so it is also the part
 * worth unit-testing.
 *
 * Ported from the Vite `toOptions` in `src/api/customOptions.ts`, rule for rule.
 */

/** An empty, well-formed set — so a failed or partial response can never crash a render. */
export const EMPTY_CUSTOM_OPTIONS: CustomOptionsDto = {
  garments: [],
  colours: [],
  sizes: [],
  print_types: [],
}

/**
 * The envelope's `data` as the four lists, keeping the API's own order in each.
 *
 * A missing or non-array value for any key becomes an empty list rather than being passed
 * through, because the page maps over all four unconditionally — one `null` would throw
 * during render. Order is never touched: `display_order` is the admin's curated sequence
 * and the backend has already applied it, so re-sorting here could only disagree with it.
 */
export function toCustomOptions(data: unknown): CustomOptionsDto {
  if (!data || typeof data !== 'object') return EMPTY_CUSTOM_OPTIONS

  const d = data as Partial<Record<keyof CustomOptionsDto, unknown>>
  const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

  return {
    garments: list(d.garments),
    colours: list(d.colours),
    sizes: list(d.sizes),
    print_types: list(d.print_types),
  }
}

/** True when there is nothing to render a builder from — every list is empty. */
export function hasNoCustomOptions(options: CustomOptionsDto): boolean {
  return (
    options.garments.length === 0 &&
    options.colours.length === 0 &&
    options.sizes.length === 0 &&
    options.print_types.length === 0
  )
}
