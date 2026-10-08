import { Link } from 'react-router-dom'

/**
 * The "Wear Your Story" promo that sends shoppers to the Custom Piece builder.
 *
 * This is a SEPARATE banner, not a carousel slide. The homepage carousel is driven by
 * `/v1/auth_carousel/` and is admin-managed; this poster is a fixed asset and belongs to
 * the product-grid section, directly under its VIEW ALL button.
 *
 * The artwork already carries its own headline and a CREATE YOURS button, so no text or
 * CTA is drawn over it — a second "Create yours" would simply duplicate what the shopper
 * can already read. The whole banner is the link instead, which is also why the `alt` text
 * is written as the link's purpose rather than as a description of the photograph: for a
 * link wrapping a single image, that `alt` IS the accessible name.
 *
 * Sizing: the poster is rendered at its own 1600x665 aspect ratio with `h-auto`, so it
 * scales down intact at every width. Nothing is cropped, so the two models and the
 * headline survive on a phone exactly as they do on a desktop — the trade is that the
 * banner gets short on a narrow screen rather than losing part of the picture. `width` and
 * `height` are set so the browser reserves the right space before the file arrives and the
 * grid above it does not jump.
 */
export function CustomPieceBanner() {
  return (
    <Link
      to="/custom-piece"
      className="mt-12 block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-black"
    >
      <img
        src="/images/custom-piece-banner.jpeg"
        alt="Wear your story — design your own custom Panchvastra piece"
        width={1600}
        height={665}
        loading="lazy"
        decoding="async"
        className="block h-auto w-full"
      />
    </Link>
  )
}
