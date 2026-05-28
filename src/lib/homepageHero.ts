import type { HomepageContent, HomepageHeroSlide } from '@/types/homepage'

/** Fixed homepage carousel size (matches original storefront). */
export const HERO_SLIDE_COUNT = 3

export function defaultHeroSlides(): HomepageHeroSlide[] {
  return [
    {
      id: 'new-design',
      eyebrow: 'Spotlight',
      title: 'New Arrivals',
      sub: 'Fresh cuts, dye stories, and hardware details — built for the feed and for everyday rotation.',
      tone: 'light',
      sectionClassName:
        'border-zinc-200 bg-gradient-to-br from-orange-50 via-white to-zinc-100 dark:border-zinc-800 dark:from-orange-950/30 dark:via-zinc-950 dark:to-zinc-900',
      primaryCta: { label: 'Shop new', to: '/shop?sort=popular' },
      secondaryCta: { label: 'Our story', to: '/about' },
    },
    {
      id: 'combo',
      eyebrow: 'Build a fit',
      title: 'Combo',
      sub: 'Pair tees with shorts and stack silhouettes — curated bundles for better value on full looks.',
      tone: 'dark',
      sectionClassName:
        'border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black',
      primaryCta: { label: 'Shop combos', to: '/shop' },
      secondaryCta: { label: 'T-shirts', to: '/shop?category=regular-tee' },
    },
    {
      id: 'exhibitions',
      eyebrow: 'In real life',
      title: 'Exhibitions',
      sub: 'Pop-ups, art walls, and community drops. See where PANCHVASTRA lands next and join the line.',
      tone: 'light',
      sectionClassName:
        'border-zinc-200 bg-gradient-to-b from-zinc-100 to-white dark:border-zinc-800 dark:from-zinc-950 dark:to-zinc-900',
      primaryCta: { label: 'Get updates', to: '/contact' },
      secondaryCta: { label: 'Shop all', to: '/shop' },
    },
  ]
}

function mergeSlide(saved: HomepageHeroSlide | undefined, fallback: HomepageHeroSlide): HomepageHeroSlide {
  if (!saved) return { ...fallback }
  return {
    ...fallback,
    ...saved,
    id: saved.id?.trim() || fallback.id,
    eyebrow: saved.eyebrow ?? fallback.eyebrow,
    title: saved.title ?? fallback.title,
    sub: saved.sub ?? fallback.sub,
    tone: saved.tone ?? fallback.tone,
    sectionClassName: saved.sectionClassName?.trim() || fallback.sectionClassName,
    backgroundImage: saved.backgroundImage?.trim() || undefined,
    primaryCta: {
      label: saved.primaryCta?.label?.trim() || fallback.primaryCta.label,
      to: saved.primaryCta?.to?.trim() || fallback.primaryCta.to,
    },
    secondaryCta:
      saved.secondaryCta?.label?.trim() && saved.secondaryCta?.to?.trim()
        ? {
            label: saved.secondaryCta.label.trim(),
            to: saved.secondaryCta.to.trim(),
          }
        : fallback.secondaryCta,
  }
}

/** Always exactly three slides — saved edits per index, defaults fill gaps. */
export function mergeHeroSlides(
  saved: HomepageHeroSlide[] | undefined,
  defaults: HomepageHeroSlide[] = defaultHeroSlides(),
): HomepageHeroSlide[] {
  return Array.from({ length: HERO_SLIDE_COUNT }, (_, i) => mergeSlide(saved?.[i], defaults[i]!))
}

export function sanitizeHeroSlides(slides: HomepageHeroSlide[]): HomepageHeroSlide[] {
  return mergeHeroSlides(
    slides.map((s) => ({
      ...s,
      id: s.id.trim(),
      eyebrow: s.eyebrow.trim(),
      title: s.title.trim(),
      sub: s.sub.trim(),
      backgroundImage: s.backgroundImage?.trim() || undefined,
      sectionClassName: s.sectionClassName.trim(),
      primaryCta: {
        label: s.primaryCta.label.trim(),
        to: s.primaryCta.to.trim() || '/shop',
      },
      secondaryCta:
        s.secondaryCta?.label.trim() && s.secondaryCta?.to.trim()
          ? { label: s.secondaryCta.label.trim(), to: s.secondaryCta.to.trim() }
          : undefined,
    })),
  )
}

/** Merge saved homepage with defaults; carousel is always three slides. */
export function normalizeHomepageContent(
  raw: HomepageContent | undefined,
  fallback: HomepageContent,
): HomepageContent {
  const merged = { ...fallback, ...raw }
  const defaults = fallback.heroSlides?.length ? fallback.heroSlides : defaultHeroSlides()
  const hasSavedSlides = Array.isArray(raw?.heroSlides) && raw.heroSlides.length > 0
  let heroSlides = mergeHeroSlides(hasSavedSlides ? raw!.heroSlides : undefined, defaults)

  if (raw && !hasSavedSlides && (raw.heroTitle?.trim() || raw.heroEyebrow?.trim() || raw.heroSub?.trim())) {
    heroSlides = [...heroSlides]
    heroSlides[0] = {
      ...heroSlides[0],
      eyebrow: raw.heroEyebrow?.trim() || heroSlides[0].eyebrow,
      title: raw.heroTitle?.trim() || heroSlides[0].title,
      sub: raw.heroSub?.trim() || heroSlides[0].sub,
    }
  }

  return { ...merged, heroSlides }
}
