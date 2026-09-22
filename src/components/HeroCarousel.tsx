import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { HomepageHeroSlide } from '@/types/homepage'

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

  /**
   * The hero's single call to action. Shared by the mobile and desktop branches.
   *
   * One centred button: the secondary "Our story" link was removed, and the row is now
   * `justify-center` in both branches so the button reads as centred against the hero at
   * every width. `s.secondaryCta` is left untouched on the slide type and the API payload —
   * it is simply no longer rendered here.
   */
  const renderActions = (s: HeroCarouselSlide) => (
    <div className="flex w-full justify-center">
      <Link to={s.primaryCta.to} className={'inline-flex items-center justify-center border border-white/70 bg-white/80 px-7 py-3 text-xs font-extrabold uppercase tracking-[0.14em] text-black backdrop-blur-md transition-colors hover:bg-white/95'}>
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
    ) : null

  /**
   * The scrim that keeps the action legible over any admin-uploaded artwork.
   *
   * Values unchanged (85/65/40 -> 60/40/15 was a previous task). The button is white-filled
   * with black text, so it stays readable anywhere along the ramp now that it is centred.
   */
  const scrimClass = 'pointer-events-none absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/15'

  return (
    <>
      {/* ------------------------------------------ mobile: native swipe carousel */}
      <section className="relative border-b border-zinc-800 bg-[#050505] lg:hidden">
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
                 * `pb-6`/`sm:pb-8` keeps the button close to the bottom edge of the frame
                 * with just enough margin that it isn't flush against it. A fixed offset
                 * (rather than a percentage of width) so it reads as "bottom of the image"
                 * at every viewport instead of drifting up as the ratio changes.
                 */
                className="relative flex aspect-[4/3] w-full shrink-0 snap-start flex-col justify-end px-4 pb-6 pt-5 sm:aspect-[16/9] sm:pb-8 sm:pt-4"
              >
                {bg ? (
                  <div
                    className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
                    style={{ backgroundImage: `url(${JSON.stringify(bg)})` }}
                    aria-hidden
                  />
                ) : null}
                <div className={scrimClass} aria-hidden />
                <div className="relative">
                  {renderActions(s)}
                </div>
              </div>
            )
          })}
        </div>

        {/* Dots sit under the track, so they appear once rather than repeating on every
            slide. Centred under the button now that the feature line no longer shares the
            row, which also keeps them clearly separated from the CTA. */}
        <div className="flex items-center justify-center px-4 py-4">
          {renderDots()}
        </div>
      </section>

      {/* ------------------------------- desktop: existing fade carousel */}
      {/* Dots live outside the image box (below it, like the mobile track) so the button
          itself can sit at the true bottom of the artwork instead of sharing that space. */}
      <div className="hidden border-b border-zinc-800 bg-[#050505] lg:block">
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
          className="relative flex min-h-[26rem] flex-col justify-end overflow-hidden px-4 pb-8 pt-16 lg:aspect-[16/9]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <AnimatePresence mode="wait" initial={false}>
            {bgImage ? (
              <motion.div
                key={`bg-${slide.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.45 }}
                // No grayscale: these are admin-uploaded carousel images from
                // /v1/auth_carousel/, so they show in their real colours. The scrim below
                // still keeps the actions legible over them.
                className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${JSON.stringify(bgImage)})` }}
                aria-hidden
              />
            ) : null}
          </AnimatePresence>
          {bgImage ? (
            <div className={scrimClass} aria-hidden />
          ) : (
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, #ffffff 0, #ffffff 1px, transparent 1px, transparent 34px)',
              }}
              aria-hidden
            />
          )}

          {/* `w-full` because the section is a flex column: without it this becomes a flex
              item sized to its content and `mx-auto` would centre it instead of keeping the
              usual left-aligned 6xl container. */}
          <div className="relative mx-auto w-full max-w-6xl">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={slide.id}
                initial={{ opacity: 0, x: 32 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -28 }}
                transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                // The single call to action sits at the BOTTOM of this block, centred, so it
                // lands at the bottom of the hero image itself.
                className="flex min-h-[230px] items-end justify-center md:min-h-[300px]"
              >
                {renderActions(slide)}
              </motion.div>
            </AnimatePresence>
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
        </section>

        <div className="flex items-center justify-center py-4">
          {renderDots()}
        </div>
      </div>
    </>
  )
}
