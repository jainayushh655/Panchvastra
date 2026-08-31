import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { HomepageHeroSlide } from '@/types/homepage'

export type HeroCarouselSlide = HomepageHeroSlide

type Props = {
  slides: HeroCarouselSlide[]
  /** Auto-advance interval in ms; set 0 to disable */
  autoMs?: number
}

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

  if (!n) return null

  const slide = slides[i]
  const bgImage = slide.backgroundImage?.trim()

  return (
    <section
      className="relative overflow-hidden border-b border-zinc-800 bg-[#050505] px-4 py-16 md:py-24"
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
            className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat grayscale"
            style={{ backgroundImage: `url(${JSON.stringify(bgImage)})` }}
            aria-hidden
          />
        ) : null}
      </AnimatePresence>
      {bgImage ? (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/85 via-black/65 to-black/40" aria-hidden />
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

      <div className="relative mx-auto max-w-6xl">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-[230px] md:min-h-[300px]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">
              Panchvastra Edit — {slide.eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl whitespace-pre-line text-[clamp(3rem,8vw,6.5rem)] font-display font-bold uppercase leading-[0.95] tracking-tight text-white">
              {slide.title}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-zinc-300 md:text-lg">{slide.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={slide.primaryCta.to}
                className="inline-flex items-center justify-center bg-white px-7 py-3 text-xs font-bold uppercase tracking-[0.14em] text-black transition-colors hover:bg-zinc-200"
              >
                {slide.primaryCta.label}
              </Link>
              {slide.secondaryCta ? (
                <Link
                  to={slide.secondaryCta.to}
                  className="inline-flex items-center justify-center border border-white px-7 py-3 text-xs font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-white/10"
                >
                  {slide.secondaryCta.label}
                </Link>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>

        {n > 1 ? (
          <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
            <div className="hidden items-center gap-3 border border-zinc-700 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 md:flex">
              Premium cotton
              <span className="h-1 w-1 rounded-full bg-zinc-500" />
              Limited drops
              <span className="h-1 w-1 rounded-full bg-zinc-500" />
              Crafted to layer
            </div>
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
          </div>
        ) : null}
      </div>
    </section>
  )
}
