import { useEffect, useRef, useState, useSyncExternalStore } from 'react'

import type { HomepageHeroSlide } from '@/types/homepage'

/**
 * `true` once the viewport is at Tailwind's `lg` breakpoint or wider.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * WHY THE TWO HERO BRANCHES ARE NO LONGER BOTH IN THE DOM
 * ──────────────────────────────────────────────────────────────────────────────
 * The hero's artwork used to be painted as a CSS `background-image`, which has one
 * accidental virtue — a `display: none` element never fetches it, so the `lg:hidden`
 * mobile track cost a desktop visitor nothing — and one serious cost: a background image
 * is invisible to the browser's preload scanner. It is discovered only after the CSS that
 * names it has been parsed, which here means after the whole JavaScript bundle has
 * downloaded, parsed, run and rendered. On a phone that is the single largest delay
 * before the hero — the page's LCP element — appears.
 *
 * An `<img>` fixes the discovery problem (and can carry `fetchpriority`), but it is
 * fetched even inside a `display: none` subtree. Swapping the markup alone would have
 * made every desktop visitor download the mobile slides as well as the desktop ones.
 *
 * So the branch is now CHOSEN rather than hidden: exactly one of the two is rendered, and
 * a desktop visitor never has the mobile track's images in the document at all. This is a
 * client-rendered app, so the first render already knows the real viewport width — there
 * is no hydration pass to mismatch, and nothing flashes.
 *
 * `useSyncExternalStore` subscribes to the media query itself rather than to a resize
 * listener, so it fires once on an actual breakpoint crossing instead of on every pixel
 * of a window drag.
 */
const LG_QUERY = '(min-width: 1024px)'

function subscribeToLg(onChange: () => void) {
  if (typeof window === 'undefined') return () => {}
  const mql = window.matchMedia(LG_QUERY)
  mql.addEventListener('change', onChange)
  return () => mql.removeEventListener('change', onChange)
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(
    subscribeToLg,
    () => window.matchMedia(LG_QUERY).matches,
    // Server snapshot: mobile-first, matching how the rest of the app is written.
    () => false,
  )
}

export type HeroCarouselSlide = HomepageHeroSlide

type Props = {
  slides: HeroCarouselSlide[]
  /** Auto-advance interval in ms; set 0 to disable */
  autoMs?: number
}

/**
 * Desktop-only prev/next control.
 *
 * Hidden below `md` so the existing mobile hero — its dots, autoplay and layout — is
 * untouched. The translucent fill plus hairline border keeps it legible over any
 * admin-uploaded image while staying in the site's black/white editorial language.
 */
const arrowClass = (position: string) =>
  'absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center ' +
  'border border-white/35 bg-black/45 pb-1 text-3xl leading-none text-white backdrop-blur-sm ' +
  'transition-colors hover:border-white hover:bg-black/75 focus-visible:outline ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:flex ' +
  position

export function HeroCarousel({ slides, autoMs = 5000 }: Props) {
  const isDesktop = useIsDesktop()
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = slides.length

  // Single timer, re-armed for a fresh `autoMs` window whenever the slide
  // changes — including manual indicator clicks — so autoplay always
  // continues cleanly from the most recent slide with no leaked timers.
  useEffect(() => {
    if (n <= 1 || !autoMs || paused) return
    const t = window.setTimeout(() => setI((x) => (x + 1) % n), autoMs)
    return () => window.clearTimeout(t)
  }, [i, n, autoMs, paused])

  /** The mobile swipe track, so autoplay and the dots can move it. */
  const trackRef = useRef<HTMLDivElement | null>(null)
  /** Fires once the swipe has come to rest, to normalise off a cloned edge slide. */
  const settleRef = useRef<number | undefined>(undefined)

  /*
   * A native snap track has a finite extent, so the last slide is a hard stop. To make the
   * swipe continuous the track renders one clone at each end:
   *
   *   [ clone of LAST ][ 1 ][ 2 ] ... [ N ][ clone of FIRST ]
   *
   * Swiping past an end lands on a clone, which is pixel-identical to the real slide it
   * copies; once the scroll settles the container is silently repositioned to that real
   * slide with no animation, so the loop is invisible. Cloning is skipped entirely for a
   * single slide, which keeps that case exactly as it was.
   */
  const loop = n > 1
  const physicalSlides = loop ? [slides[n - 1], ...slides, slides[0]] : slides
  /** Physical track position -> the logical slide the dots represent. */
  const toLogical = (physical: number) => (loop ? (physical - 1 + n) % n : 0)

  /** Reads the track only when it is actually laid out (it is display:none on desktop). */
  const readTrack = () => {
    const track = trackRef.current
    if (!track) return null
    const width = track.clientWidth
    if (!width) return null
    return { track, width, physical: Math.round(track.scrollLeft / width) }
  }

  /** Jumps off a clone onto its real counterpart. Instant, so the swap is not seen. */
  const normalise = () => {
    const read = readTrack()
    if (!read || !loop) return
    const { track, width, physical } = read
    if (physical === 0) track.scrollTo({ left: n * width, behavior: 'instant' })
    else if (physical === n + 1) track.scrollTo({ left: width, behavior: 'instant' })
  }

  /*
   * Start on the first REAL slide rather than the leading clone.
   *
   * `isDesktop` is a dependency because the mobile track is now mounted and unmounted at
   * the `lg` breakpoint rather than hidden with CSS. Without it, dragging a desktop window
   * narrow would mount a fresh track at `scrollLeft: 0` — which is the clone of the LAST
   * slide — and the hero would open on the wrong image.
   */
  useEffect(() => {
    const read = readTrack()
    if (!read || !loop) return
    read.track.scrollTo({ left: read.width, behavior: 'instant' })
    // Only on mount, when the slide count changes, and when the track reappears.
  }, [loop, n, isDesktop])

  /*
   * Keeps the mobile track in step with `i`.
   *
   * It moves by the SHORTEST way round the ring from wherever the track currently sits, so
   * autoplay wrapping from the last slide to the first glides forward onto the clone rather
   * than rewinding the whole track. It returns early when the track is already showing `i`,
   * so a swipe — which sets `i` FROM the scroll position — is never scrolled back on top of,
   * and autoplay never fights the finger. Changing `i` also re-arms the single autoplay
   * timer above, so a swipe naturally restarts the countdown instead of racing it.
   */
  useEffect(() => {
    const read = readTrack()
    if (!read) return
    const { track, width, physical } = read
    const current = toLogical(physical)
    if (current === i) return

    let delta = ((i - current) % n + n) % n
    if (delta > n / 2) delta -= n
    track.scrollTo({ left: (physical + delta) * width, behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  if (!n) return null

  const slide = slides[i]
  const bgImage = slide.backgroundImage?.trim()

  /**
   * Manual navigation writes to the same `i` the dots and autoplay already use, wrapping
   * around whatever number of slides the backend returned. Because the autoplay effect
   * depends on `i`, moving a slide re-arms that one timer for a fresh window — no second
   * interval is ever created.
   */
  const go = (step: number) => setI((x) => (x + step + n) % n)

  /*
   * There is no scrim over the artwork. The dark left-to-right gradient that used to sit on
   * top of every slide has been removed, so an admin-uploaded image is shown exactly as it
   * was uploaded, at full strength, on both the mobile and desktop branches.
   *
   * What it was there for was contrast behind the call to action. That button is its own
   * white fill with black text, so it carries its own contrast rather than borrowing it
   * from a darkened image.
   */

  return (
    <>
      {/*
        ------------------------------------------ mobile: native swipe carousel

        Rendered only below `lg`. The `lg:hidden` it replaces still put every slide's
        `<img>` in the document on a desktop, and a `display: none` ancestor does not stop
        an `<img>` from being fetched — see `useIsDesktop`.
      */}
      {isDesktop ? null : (
      <section className="relative border-b border-zinc-800 bg-espresso">
        <div
          ref={trackRef}
          /*
           * Same architecture as the PDP gallery's mobile track: native scroll-snap, no
           * dependency and no gesture handling. The active slide is derived from scroll
           * position, so it stays correct whether the customer swipes, flicks, or the
           * track is moved by autoplay or the dots. `overscroll-x-contain` stops a swipe
           * chaining out to the page or the browser's back gesture, and each slide is
           * exactly one container wide so the PAGE never gains horizontal overflow.
           */
          onScroll={(event) => {
            const track = event.currentTarget
            const slideWidth = track.clientWidth || 1
            const physical = Math.round(track.scrollLeft / slideWidth)
            const next = toLogical(physical)
            setI((prev) => (prev === next ? prev : next))

            // Normalise only once the swipe has come to rest, so the jump off a clone is
            // never made mid-gesture.
            window.clearTimeout(settleRef.current)
            settleRef.current = window.setTimeout(normalise, 140)
          }}
          className="pv-hide-scrollbar flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain"
          role="group"
          aria-label={`Hero slides, ${n} in total`}
        >
          {physicalSlides.map((s, physical) => {
            const bg = s.backgroundImage?.trim()
            // The first and last entries are clones when looping; they are hidden from
            // assistive tech and taken out of the tab order so the real slides stay the
            // only announced, focusable ones.
            const isClone = loop && (physical === 0 || physical === physicalSlides.length - 1)
            return (
              <div
                key={`${s.id}-${physical}`}
                {...(isClone ? { inert: true, 'aria-hidden': true } : {})}
                /*
                 * The artwork is 16:9, so from `sm` up the slide keeps that exact ratio and
                 * `cover` has nothing to crop — tablets (768/820/834) get 432-469px of the
                 * complete composition, which needs no help.
                 *
                 * A phone is too narrow for that: 16:9 at 390px is a 219px letterbox strip
                 * that the buttons then sit on top of. Below `sm` the slide is 4:3 instead,
                 * which gives 292-360px of hero and costs 25% of the image width — trimmed
                 * evenly from both edges by `bg-center`, so the centred subject is kept. The
                 * ratio scales the box, so the image is never stretched at any width.
                 */
                /*
                 * `pb-16` reserves the strip the dots now occupy INSIDE the frame, so the
                 * button still reads as sitting near the bottom of the image with the dots
                 * directly beneath it. A fixed offset (rather than a percentage of width)
                 * so that spacing stays constant instead of drifting as the ratio changes.
                 */
                className="relative flex aspect-[16/9] w-full shrink-0 snap-start flex-col justify-end px-4 pb-11 pt-5 sm:pb-16 sm:pt-4"
              >
                {bg ? (
                  <img
                    src={bg}
                    alt=""
                    aria-hidden
                    /*
                     * The hero is the homepage's LCP element on a phone, and this is the
                     * only image on the first screen that matters. `high` priority moves it
                     * ahead of everything else the browser has queued; `eager` keeps it out
                     * of the lazy queue it would otherwise share with the off-screen slides.
                     *
                     * Physical index 1 is the FIRST REAL slide — index 0 is the clone of the
                     * last one that makes the swipe loop continuous (see above). Every other
                     * slide is off to the side and lazy, so a visitor who never swipes never
                     * downloads them. Before this they all loaded at once, competing with
                     * the one slide actually on screen.
                     */
                    fetchPriority={physical === 1 ? 'high' : 'low'}
                    loading={physical === 1 ? 'eager' : 'lazy'}
                    decoding="async"
                    /*
                     * One ratio at every width: the artwork's own 16:9.
                     *
                     * This box used to be 4:3 below `sm`, which made the hero taller on a
                     * phone but cost 25% of each slide's WIDTH to the crop — measured, not
                     * estimated. A focal shift to 25% only chose which quarter was thrown
                     * away; it never stopped the throwing away. Admin-uploaded artwork is
                     * laid out as a full banner, so losing a quarter of it is losing part of
                     * the message. Matching the source ratio means `cover` is an exact fit
                     * and nothing is cropped on any screen.
                     */
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
                  />
                ) : null}
                <div className="relative">
                </div>
              </div>
            )
          })}
        </div>

        {/*
          Dots overlay the bottom of the track rather than sitting in a strip beneath it.
          Rendered once here (not inside the slide loop) so there is still exactly one set
          for the whole carousel, and taken out of flow so the section's height is exactly
          the track's height — which is exactly the artwork's height. That is what removes
          the black band; nothing is being covered up.
        */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center px-4 pb-2 sm:pb-4">
          {n > 1 ? (
            <div className="flex gap-2">
              {slides.map((_, idx) => (
                <button
                  key={slides[idx].id}
                  type="button"
                  aria-label={`Slide ${idx + 1} of ${n}`}
                  aria-current={idx === i}
                  onClick={() => setI(idx)}
                  className="flex h-8 items-center justify-center px-2"
                >
                  {/* Dot is drawn by the inner span so the button itself can carry a
                      comfortable tap area without changing the visual size. */}
                  <span
                    className={`block h-2 rounded-full transition-all ${
                      idx === i ? 'w-8 bg-white' : 'w-2 bg-zinc-600 hover:bg-zinc-400'
                    }`}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </section>
      )}

      {/* ------------------------------- desktop: existing fade carousel */}
      {/* Dots live outside the image box (below it, like the mobile track) so the button
          itself can sit at the true bottom of the artwork instead of sharing that space. */}
      {isDesktop ? (
      <div className="border-b border-zinc-800 bg-espresso">
        <section
          /*
           * The carousel artwork is 16:9 (verified: 1280x720 and 1920x1080). The hero used to
           * take its height from its content, which made it ~2.6:1 on desktop — so `bg-cover`
           * had to crop roughly a third off the top and bottom of every image. Giving the
           * section the artwork's own 16:9 ratio makes `cover` and `contain` equivalent, so
           * the full composition is shown with nothing cut and nothing distorted.
           *
           * `min-h` keeps the box tall enough for the actions where a 16:9 box would be
           * shorter than the content; the content is bottom-aligned so it stays lower-left.
           */
          className="pv-desktop-hero relative flex flex-col justify-end overflow-hidden px-4 pb-20 pt-16"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/*
            The `key` is what animates this: changing slide remounts the element, which
            restarts the CSS fade. Same 450ms as the motion component it replaces.

            No grayscale and nothing laid over the top: these are admin-uploaded carousel
            images from /v1/auth_carousel/, so they show in their real colours at full
            strength. The fade is the transition between slides only.
          */}
          {bgImage ? (
            <img
              key={`bg-${slide.id}`}
              src={bgImage}
              alt=""
              aria-hidden
              // The desktop hero's LCP element, and the only slide in the DOM at a time.
              fetchPriority="high"
              decoding="async"
              className="pv-hero-fade pointer-events-none absolute inset-0 h-full w-full object-cover object-center"
            />
          ) : null}
          {/* Nothing is laid over the artwork. The faint diagonal hatch is only the
              no-artwork fallback, so it never touches a real carousel image. */}
          {bgImage ? null : (
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, #f6ebdd 0, #f6ebdd 1px, transparent 1px, transparent 34px)',
              }}
              aria-hidden
            />
          )}

          {/* `w-full` because the section is a flex column: without it this becomes a flex
              item sized to its content and `mx-auto` would centre it instead of keeping the
              usual left-aligned 6xl container. */}
          <div className="relative mx-auto w-full max-w-6xl">
            {/*
              Keyed on the slide, so it remounts and replays the CSS enter animation —
              same 380ms and same easing curve as before.

              The single call to action sits at the BOTTOM of this block, centred, so it
              lands at the bottom of the hero image itself.
            */}
            <div
              key={slide.id}
              className="pv-hero-enter flex min-h-[230px] items-end justify-center md:min-h-[300px]"
            >
            </div>
          </div>

          {/* --------------------------------- desktop prev / next, 2+ slides only */}
          {n > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous slide"
                className={arrowClass('left-3 lg:left-6')}
              >
                <span aria-hidden>&lsaquo;</span>
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next slide"
                className={arrowClass('right-3 lg:right-6')}
              >
                <span aria-hidden>&rsaquo;</span>
              </button>
            </>
          ) : null}

          {/*
            Dots overlay the bottom of the artwork, matching the mobile branch. Previously
            they sat in a strip below the section, which added a constant 65px black band
            between the image and the next homepage section at every width. Out of flow, so
            the section's height stays exactly `aspect-[16/9]` = the artwork's height.
          */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center px-4 pb-6">
            {n > 1 ? (
              <div className="flex gap-2">
                {slides.map((_, idx) => (
                  <button
                    key={slides[idx].id}
                    type="button"
                    aria-label={`Slide ${idx + 1} of ${n}`}
                    aria-current={idx === i}
                    onClick={() => setI(idx)}
                    className="flex h-8 items-center justify-center px-2"
                  >
                    {/* Dot is drawn by the inner span so the button itself can carry a
                        comfortable tap area without changing the visual size. */}
                    <span
                      className={`block h-2 rounded-full transition-all ${
                        idx === i ? 'w-8 bg-white' : 'w-2 bg-zinc-600 hover:bg-zinc-400'
                      }`}
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>
      ) : null}
    </>
  )
}
