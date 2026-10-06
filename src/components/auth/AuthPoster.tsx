const POSTER = '/images/auth-poster.jpg'

/**
 * Feathers the artwork's top and bottom edges into the blurred backdrop behind it.
 *
 * Applied from `lg` up only. Below that the panel is already 16:9, so the artwork fills it
 * edge to edge and there is no seam to hide — fading it there would just soften the top and
 * bottom of the banner for no reason.
 */
/*
 * Written out in full rather than composed from a variable: Tailwind finds classes by
 * scanning source text for complete strings, so a name built by interpolation is never
 * generated and the mask silently does nothing.
 */
const FEATHER_LG =
  'lg:[mask-image:linear-gradient(to_bottom,transparent_0,#000_7%,#000_93%,transparent_100%)] lg:[-webkit-mask-image:linear-gradient(to_bottom,transparent_0,#000_7%,#000_93%,transparent_100%)]'

/**
 * The brand poster shown beside the customer login and signup forms.
 *
 * A fixed brand asset, not the backend auth carousel: these two screens no longer fetch
 * carousel slides, so there is nothing to load, nothing to rotate, and no request between
 * the shopper and the sign-in form. The carousel endpoint and its admin screen are
 * untouched — the homepage hero still reads from them.
 *
 * WHY TWO COPIES OF THE SAME IMAGE.
 *
 * The poster is 16:9, but this panel is half the window and full height — roughly 0.8:1 on
 * a typical laptop. Neither simple fit works on its own:
 *   - `cover` fills the panel but crops ~55% of the width away, and the brand mark sits at
 *     the far left, so it is the first thing lost.
 *   - `contain` keeps the whole composition but leaves deep black bands above and below.
 *
 * So the artwork is drawn sharp and complete in front, over a blurred, over-scaled copy of
 * itself that fills the panel behind it. The composition survives intact at every window
 * shape, the panel is never empty, and the backdrop reads as an extension of the poster's
 * own glow rather than as letterboxing. It costs no extra request — both layers are the
 * same URL, so the browser fetches it once.
 *
 * The sharp copy sits in a wrapper locked to the artwork's own 16:9 rather than being
 * `object-contain`ed inside a full-height box. With `contain`, the element still measures
 * the whole panel while the pixels occupy a band in the middle, so an edge treatment lands
 * on empty space instead of on the picture. Sizing the wrapper to the artwork puts its real
 * edges where the feather can reach them.
 */
export function AuthPoster() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-black">
      {/* Backdrop: fills whatever shape the panel is. Blurred and dimmed so it never
          competes with the sharp copy in front. */}
      <img
        src={POSTER}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full scale-125 object-cover opacity-45 blur-2xl"
      />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className={`aspect-[16/9] max-h-full w-full ${FEATHER_LG}`}>
          <img
            src={POSTER}
            alt=""
            // Decorative — the form beside it carries all the information on the screen.
            aria-hidden
            // The largest thing above the fold on this route; deferring it would just show
            // an empty black panel first.
            fetchPriority="high"
            decoding="async"
            width={1280}
            height={720}
            // The wrapper is the artwork's own ratio, so `cover` here is an exact fit and
            // crops nothing.
            className="h-full w-full object-cover object-center"
          />
        </div>
      </div>
    </div>
  )
}
