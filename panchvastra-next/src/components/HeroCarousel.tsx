'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { BackendImage } from '@/components/BackendImage'
import type { HomepageHeroSlide } from '@/types/homepage'

export type HeroCarouselSlide = HomepageHeroSlide

type Props = {
  slides: HeroCarouselSlide[]
  /** Auto-advance interval in ms; set 0 to disable */
  autoMs?: number
}

/**
 * The homepage hero.
 *
 * Ported from the Vite `HeroCarousel`. The two-branch structure is unchanged — a native
 * scroll-snap swipe track with cloned edges below `lg`, a fading stack from `lg` up — and
 * so are the aspect ratios, the dots, the desktop arrows, the autoplay timer and the
 * hover-pause. Three things changed, each for a stated reason.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 1. NO FRAMER-MOTION — the animation is CSS
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite version animates with `framer-motion`: `AnimatePresence mode="wait"` around a
 * background `div` (opacity crossfade, 0.45s) and around the call-to-action block
 * (opacity + 32px slide-in, 0.38s). That library is not a dependency of this application,
 * and adding it would put tens of kilobytes of JavaScript on the critical path of the
 * most performance-sensitive page in the catalogue — against this phase's explicit
 * mobile-first performance brief — to drive two transitions the platform can do natively.
 *
 * So: the slide backgrounds are stacked and cross-faded with a CSS `opacity` transition
 * over the same 450ms, and the call to action replays a 380ms keyframe (`pv-hero-copy-in`
 * in `globals.css`) when the slide changes, with the same easing curve and the same 32px
 * offset.
 *
 * ONE VISIBLE DIFFERENCE, AND IT NEEDS SIGN-OFF: `mode="wait"` made the two phases
 * SEQUENTIAL — the outgoing slide finished fading out before the incoming one began, so a
 * transition took ~0.9s and passed through the espresso backdrop on the way. The CSS
 * version cross-fades SIMULTANEOUSLY: 450ms, image to image, with no dip to the
 * background. It is the same motion vocabulary and, if anything, a cleaner transition —
 * but it is not frame-identical, so it is called out rather than slipped in.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 2. SLIDE IMAGES ARE `next/image`, NOT CSS BACKGROUNDS
 * ──────────────────────────────────────────────────────────────────────────────
 * The Vite version paints each slide with `style={{ backgroundImage: url(...) }}`. A CSS
 * background cannot be prioritised, preloaded, lazily deferred or served at the right
 * width, and the hero is the Largest Contentful Paint element on the homepage — so the
 * one image that matters most for the mobile score was the one the browser discovered
 * last.
 *
 * `fill` + `object-cover` + `object-center` is the exact rendering equivalent of
 * `bg-cover bg-center bg-no-repeat`, so the composition and cropping are unchanged. What
 * it adds: the FIRST slide carries `priority` (preloaded, never lazy), and every other
 * slide is lazy — so a three-image hero now costs one image on first paint instead of
 * three. See `BackendImage` for why these bypass the image optimizer for the moment.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * 3. `react-router` -> `next/link`
 * ──────────────────────────────────────────────────────────────────────────────
 * Mechanical: `to` -> `href` on the call to action.
 */

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

  // Start on the first REAL slide rather than the leading clone.
  useEffect(() => {
    const read = readTrack()
    if (!read || !loop) return
    read.track.scrollTo({ left: read.width, behavior: 'instant' })
    // Only on mount and when the slide count changes.
  }, [loop, n])

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

    let delta = (((i - current) % n) + n) % n
    if (delta > n / 2) delta -= n
    track.scrollTo({ left: (physical + delta) * width, behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i])

  if (!n) return null

  const slide = slides[i]

  /**
   * Manual navigation writes to the same `i` the dots and autoplay already use, wrapping
   * around whatever number of slides the backend returned. Because the autoplay effect
   * depends on `i`, moving a slide re-arms that one timer for a fresh window — no second
   * interval is ever created.
   */
  const go = (step: number) => setI((x) => (x + step + n) % n)

  /**
   * The hero's single call to action. Shared by the mobile and desktop branches.
   *
   * One centred button: the secondary "Our story" link is not rendered, and the row is
   * `justify-center` in both branches so the button reads as centred against the hero at
   * every width. `s.secondaryCta` is left untouched on the slide type and the API payload —
   * it is simply not rendered here.
   *
   * The button is smaller below `sm` and full size from there up. It used to be a fixed
   * 140x42 at every width: against a 720px desktop hero that reads as a neat label;
   * against a 180px hero on a 320px phone it is a quarter of the picture. The smaller step
   * is phones only, so tablet and desktop are untouched.
   */
  const renderActions = (s: HeroCarouselSlide) => (
    <div className="flex w-full justify-center">
      <Link
        href={s.primaryCta.to}
        className="inline-flex items-center justify-center border border-white/70 bg-white/80 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[0.12em] text-black backdrop-blur-md transition-colors hover:bg-white/95 sm:px-7 sm:py-3 sm:text-xs sm:tracking-[0.14em]"
      >
        {s.primaryCta.label}
      </Link>
    </div>
  )

  /** Slide indicators. Driven by `i`, which both branches keep current. */
  const renderDots = () =>
    n > 1 ? (
      <div className="flex gap-2">
        {slides.map((_, idx) => (
          <button
            key={slides[idx].id}
            type="button"
            aria-label={`Slide ${idx + 1} of ${n}`}
            aria-current={idx === i}
            onClick={() => setI(idx)}
            /*
             * 44x44 of tappable area (Phase 4B review point 4). The Vite control is
             * `h-8 px-2` — 32px tall and 24px wide around an inactive dot, under every
             * platform's minimum and the smallest control on the page.
             *
             * The DOT ITSELF IS UNCHANGED: it is drawn by the inner `span`, which still
             * measures 8px (or 32px when active) by 8px. Only the invisible button box
             * around it grows, and the dots' position is held steady by trimming exactly
             * the same number of pixels off the row's bottom padding (see both call
             * sites), so nothing moves on screen.
             */
            className="flex h-11 min-w-11 items-center justify-center px-2"
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
    ) : null

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
      {/* ------------------------------------------ mobile: native swipe carousel */}
      <section className="relative border-b border-zinc-800 bg-espresso lg:hidden">
        <div
          ref={trackRef}
          /*
           * Native scroll-snap, no dependency and no gesture handling. The active slide is
           * derived from scroll position, so it stays correct whether the customer swipes,
           * flicks, or the track is moved by autoplay or the dots. `overscroll-x-contain`
           * stops a swipe chaining out to the page or the browser's back gesture, and each
           * slide is exactly one container wide so the PAGE never gains horizontal overflow.
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
            /*
             * The leading real slide is the LCP candidate on a phone, so it is the one
             * image allowed to load eagerly. The leading clone shows the same file, and the
             * track is scrolled onto the real slide on mount, so prioritising the real one
             * is what the browser actually paints.
             */
            const isLcpCandidate = !isClone && toLogical(physical) === 0
            return (
              <div
                key={`${s.id}-${physical}`}
                {...(isClone ? { inert: true, 'aria-hidden': true } : {})}
                /*
                 * The artwork is 16:9 and the slide keeps that exact ratio, so `cover` has
                 * nothing to crop — nothing is cut on any screen and nothing is stretched.
                 * `pb` reserves the strip the dots occupy INSIDE the frame, so the button
                 * still reads as sitting near the bottom of the image with the dots
                 * directly beneath it. A fixed offset, so that spacing stays constant
                 * instead of drifting as the viewport changes.
                 */
                className="relative flex aspect-[16/9] w-full shrink-0 snap-start flex-col justify-end px-4 pb-11 pt-5 sm:pb-16 sm:pt-4"
              >
                {bg ? (
                  <BackendImage
                    src={bg}
                    alt=""
                    aria-hidden
                    fill
                    // One slide is one viewport wide on this branch, which is every width
                    // below `lg`.
                    sizes="100vw"
                    {...(isLcpCandidate ? { priority: true } : { loading: 'lazy' as const })}
                    className="pointer-events-none object-cover object-center"
                  />
                ) : null}
                <div className="relative">{renderActions(s)}</div>
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
        {/* The dot buttons are 12px taller than the Vite original for a 44px tap target, and
            they are vertically centred, so the dots would rise by 6px. The row gives back
            exactly those 6px (pb-2 -> pb-0.5, sm:pb-4 -> sm:pb-2.5) and the dots stay where
            they were. */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center px-4 pb-0.5 sm:pb-2.5">
          {renderDots()}
        </div>
      </section>

      {/* ------------------------------- desktop: fade carousel */}
      {/* Dots live over the bottom of the image box so the button itself can sit at the
          true bottom of the artwork instead of sharing that space. */}
      <div className="hidden border-b border-zinc-800 bg-espresso lg:block">
        <section
          /*
           * The carousel artwork is 16:9 (verified: 1280x720 and 1920x1080). Giving the
           * section the artwork's own ratio makes `cover` and `contain` equivalent, so the
           * full composition is shown with nothing cut and nothing distorted.
           *
           * `min-h` keeps the box tall enough for the actions where a 16:9 box would be
           * shorter than the content; the content is bottom-aligned so it stays low.
           */
          className="relative flex min-h-[26rem] flex-col justify-end overflow-hidden px-4 pb-20 pt-16 lg:aspect-[16/9]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/*
            The stack that replaces `AnimatePresence`. Every slide's artwork is mounted
            once and only its opacity changes, so the transition is a true crossfade
            composited by the browser — no React work per frame, and no remount of an
            `<img>` mid-transition.

            Only the active slide is kept in the paint; the rest sit at `opacity-0`. These
            are admin-uploaded images shown in their real colours at full strength, with
            nothing laid over them.
          */}
          {slides.map((s, idx) => {
            const bg = s.backgroundImage?.trim()
            if (!bg) return null
            return (
              <div
                key={`bg-${s.id}`}
                className={`pointer-events-none absolute inset-0 transition-opacity duration-[450ms] ${
                  idx === i ? 'opacity-100' : 'opacity-0'
                }`}
                aria-hidden
              >
                <BackendImage
                  src={bg}
                  alt=""
                  fill
                  // The desktop hero is full-bleed, so one slide is one viewport wide.
                  sizes="100vw"
                  {...(idx === 0 ? { priority: true } : { loading: 'lazy' as const })}
                  className="object-cover object-center"
                />
              </div>
            )
          })}

          {/* Nothing is laid over the artwork. The faint diagonal hatch is only the
              no-artwork fallback, so it never touches a real carousel image. */}
          {slide.backgroundImage?.trim() ? null : (
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
              usual 6xl container. */}
          <div className="relative mx-auto w-full max-w-6xl">
            {/*
              `key` on the slide id is what replays the entrance keyframe: React remounts
              this block when the slide changes, the animation runs once, and it ends at
              its natural position. The call to action sits at the BOTTOM of the block,
              centred, so it lands at the bottom of the hero image itself.
            */}
            <div
              key={slide.id}
              className="pv-hero-copy-in flex min-h-[230px] items-end justify-center md:min-h-[300px]"
            >
              {renderActions(slide)}
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
            Dots overlay the bottom of the artwork, matching the mobile branch. Out of
            flow, so the section's height stays exactly `aspect-[16/9]` = the artwork's
            height, with no black band between the hero and the next section.
          */}
          <div className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-center px-4 pb-[18px]">
            {renderDots()}
          </div>
        </section>
      </div>
    </>
  )
}
