import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import type { HomepageHeroSlide } from '@/types/homepage'

export type HeroCarouselSlide = HomepageHeroSlide

type Props = {
  slides: HeroCarouselSlide[]
  /** Auto-advance interval in ms; set 0 to disable */
  autoMs?: number
}

export function HeroCarousel({ slides, autoMs = 6400 }: Props) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const n = slides.length

  const go = useCallback(
    (next: number) => {
      if (n === 0) return
      setI(((next % n) + n) % n)
    },
    [n],
  )

  useEffect(() => {
    if (n <= 1 || !autoMs || paused) return
    const t = window.setInterval(() => setI((x) => (x + 1) % n), autoMs)
    return () => window.clearInterval(t)
  }, [n, autoMs, paused])

  if (!n) return null

  const slide = slides[i]
  const onDark = slide.tone === 'dark'
  const bgImage = slide.backgroundImage?.trim()

  const eyebrowCls = onDark ? 'text-[#f1dfba]' : 'text-[#b07f2e] font-semibold tracking-[0.24em]'
  const titleCls = onDark ? 'text-[#d6b36d] drop-shadow-[0_8px_30px_rgba(0,0,0,0.6)]' : 'text-[#b07f2e] drop-shadow-[0_6px_24px_rgba(0,0,0,0.18)]'
  const subCls = onDark ? 'text-zinc-200' : 'text-zinc-700'

  const pillCls = onDark
    ? 'inline-flex items-center gap-2 rounded-full border border-[#d6b36d]/35 bg-[#d6b36d]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#f1dfba] backdrop-blur-sm'
    : 'inline-flex items-center gap-2 rounded-full border border-[#d8c39a] bg-[#e9dfc6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5f4210]'
  const ghostBtn = onDark ? '!text-white hover:!bg-white/10' : 'dark:!text-white'

  return (
    <section
      className={`relative overflow-hidden border-b border-zinc-200/70 px-4 py-16 transition-colors duration-500 md:py-24 ${
        bgImage ? 'border-zinc-800 bg-zinc-950' : slide.sectionClassName
      }`}
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
            className="pointer-events-none absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${JSON.stringify(bgImage)})` }}
            aria-hidden
          />
        ) : null}
      </AnimatePresence>
      {bgImage ? (
        <div
          className={`pointer-events-none absolute inset-0 ${
            onDark ? 'bg-gradient-to-r from-black/75 via-black/50 to-black/30' : 'bg-gradient-to-r from-white/90 via-white/70 to-white/40'
          }`}
          aria-hidden
        />
      ) : (
        <>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_75%_35%,rgba(214,179,109,0.28),transparent_40%),radial-gradient(ellipse_70%_45%_at_15%_0%,rgba(255,255,255,0.06),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(0,0,0,0.06))]" />
          <div className="pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-[#d6b36d]/20 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(circle_at_70%_42%,rgba(255,199,95,0.18),transparent_30%)]" aria-hidden />
          <div className="pointer-events-none absolute -left-16 top-16 h-44 w-44 rounded-full bg-white/5 blur-3xl" aria-hidden />
        </>
      )}

      <div className="relative mx-auto max-w-6xl">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={slide.id}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -28 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
            className="min-h-[250px] md:min-h-[320px]"
          >
            <div className={pillCls}>
              PANCHVASTRA EDIT
            </div>
            <p className={`type-eyebrow mt-4 ${eyebrowCls}`}>{slide.eyebrow}</p>
            <h1 className={`type-hero-title mt-4 max-w-3xl text-[clamp(3rem,7vw,6rem)] ${titleCls}`}>
              {slide.title}
            </h1>
            <p className={`mt-5 max-w-xl text-base leading-7 md:text-lg ${subCls}`}>{slide.sub}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={slide.primaryCta.to}>
                <Button size="lg">{slide.primaryCta.label}</Button>
              </Link>
              {slide.secondaryCta ? (
                <Link to={slide.secondaryCta.to}>
                  <Button variant="ghost" size="lg" className={ghostBtn}>
                    {slide.secondaryCta.label}
                  </Button>
                </Link>
              ) : null}
            </div>
          </motion.div>
        </AnimatePresence>

        {n > 1 ? (
          <>
            <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
              <div className="hidden items-center gap-3 rounded-full border border-[#d6b36d]/20 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75 backdrop-blur-sm md:flex">
                Premium cotton
                <span className="h-1 w-1 rounded-full bg-[#d6b36d]/80" />
                Limited drops
                <span className="h-1 w-1 rounded-full bg-[#d6b36d]/80" />
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
                    className={`h-2 rounded-full transition-all ${
                      idx === i
                        ? 'w-8 bg-[#d6b36d] shadow-[0_0_16px_rgba(214,179,109,0.75)]'
                        : `w-2 ${onDark ? 'bg-white/35 hover:bg-white/55' : 'bg-zinc-400/50 hover:bg-zinc-500/70 dark:bg-zinc-600 dark:hover:bg-zinc-500'}`
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => go(i - 1)}
              className={`absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border p-2.5 shadow-sm transition-colors md:flex ${
                onDark
                  ? 'border-[#d6b36d]/25 bg-black/30 text-white hover:bg-black/45'
                  : 'border-zinc-200 bg-white/90 text-zinc-800 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-white dark:hover:bg-zinc-800'
              }`}
            >
              <Chevron dir="left" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => go(i + 1)}
              className={`absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border p-2.5 shadow-sm transition-colors md:flex ${
                onDark
                  ? 'border-[#d6b36d]/25 bg-black/30 text-white hover:bg-black/45'
                  : 'border-zinc-200 bg-white/90 text-zinc-800 hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-white dark:hover:bg-zinc-800'
              }`}
            >
              <Chevron dir="right" />
            </button>
          </>
        ) : null}
      </div>
    </section>
  )
}

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d={dir === 'left' ? 'M15 19l-7-7 7-7' : 'M9 5l7 7-7 7'}
      />
    </svg>
  )
}
