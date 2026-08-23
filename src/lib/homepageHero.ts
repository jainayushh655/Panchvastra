import type {
  HomepageBannerPair,
  HomepageContent,
  HomepageFeaturedTile,
  HomepageHeroSlide,
} from '@/types/homepage'

/** Fixed homepage carousel size (matches original storefront). */
export const HERO_SLIDE_COUNT = 3

/**
 * Single configurable hero background. Swap this file at the same path to
 * update the campaign visual everywhere the hero renders — no React changes
 * needed. Currently a designed monochrome editorial placeholder; replace
 * with the final AI-generated Panchvastra campaign image when ready.
 */
const HERO_CAMPAIGN_BG = '/images/home/panchvastra-hero-editorial.svg'

function normalizeHeroBgPath(raw: string | undefined): string | undefined {
  const value = raw?.trim()
  if (!value) return undefined
  if (
    value === '/images/feature-drops-bg.jpg' ||
    value === '/images/team-bg.jpg' ||
    value === '/images/team-bg.jpeg'
  ) {
    return HERO_CAMPAIGN_BG
  }
  return value
}

export function defaultHeroSlides(): HomepageHeroSlide[] {
  return [
    {
      id: 'new-design',
      eyebrow: 'Spotlight',
      title: 'New\nArrivals',
      sub: 'Fresh cuts, raw dye stories, and hardware details — built for the feed and for everyday rotation.',
      tone: 'dark',
      backgroundImage: HERO_CAMPAIGN_BG,
      sectionClassName: 'border-zinc-800 bg-[#050505]',
      primaryCta: { label: 'Shop new', to: '/shop?sort=new-arrival' },
      secondaryCta: { label: 'Our story', to: '/about' },
    },
    {
      id: 'combo',
      eyebrow: 'Build a fit',
      title: 'Combo',
      sub: 'Pair tees with shorts and stack silhouettes — curated bundles for better value on full looks.',
      tone: 'dark',
      backgroundImage: HERO_CAMPAIGN_BG,
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
      tone: 'dark',
      backgroundImage: HERO_CAMPAIGN_BG,
      sectionClassName: 'border-zinc-800 bg-[#050505]',
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
    backgroundImage:
      normalizeHeroBgPath(saved.backgroundImage) ||
      normalizeHeroBgPath(fallback.backgroundImage) ||
      undefined,
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
      backgroundImage: normalizeHeroBgPath(s.backgroundImage),
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

function mergeBannerBlock<T extends HomepageBannerPair['sale']>(
  saved: Partial<T> | undefined,
  fallback: T,
): T {
  if (!saved) return { ...fallback }
  return {
    ...fallback,
    eyebrow: saved.eyebrow?.trim() || fallback.eyebrow,
    title: saved.title?.trim() || fallback.title,
    sub: saved.sub?.trim() || fallback.sub,
    cta: saved.cta?.trim() || fallback.cta,
    link: saved.link?.trim() || fallback.link,
  }
}

function mergeBanners(
  saved: Partial<HomepageBannerPair> | undefined,
  fallback: HomepageBannerPair,
): HomepageBannerPair {
  return {
    sale: mergeBannerBlock(saved?.sale, fallback.sale),
    arrivals: mergeBannerBlock(saved?.arrivals, fallback.arrivals),
  }
}

function mergeFeaturedTiles(
  saved: HomepageFeaturedTile[] | undefined,
  fallback: HomepageFeaturedTile[],
): HomepageFeaturedTile[] {
  if (!Array.isArray(saved) || saved.length === 0) return [...fallback]
  return saved.map((tile, i) => {
    const fb = fallback[i] ?? fallback[0]!
    return {
      ...fb,
      ...tile,
      slug: tile.slug?.trim() || fb.slug,
      title: tile.title?.trim() || fb.title,
      blurb: tile.blurb?.trim() || fb.blurb,
      badge: tile.badge?.trim() || fb.badge,
      bgClass: tile.bgClass?.trim() || fb.bgClass,
    }
  })
}

/** Merge saved homepage with defaults; carousel is always three slides. */
export function normalizeHomepageContent(
  raw: HomepageContent | undefined,
  fallback: HomepageContent,
): HomepageContent {
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

  return {
    ...fallback,
    ...raw,
    heroEyebrow: raw?.heroEyebrow?.trim() || fallback.heroEyebrow,
    heroTitle: raw?.heroTitle?.trim() || fallback.heroTitle,
    heroSub: raw?.heroSub?.trim() || fallback.heroSub,
    featuredSectionTitle: raw?.featuredSectionTitle?.trim() || fallback.featuredSectionTitle,
    trendingSectionTitle: raw?.trendingSectionTitle?.trim() || fallback.trendingSectionTitle,
    newsletterTitle: raw?.newsletterTitle?.trim() || fallback.newsletterTitle,
    newsletterSub: raw?.newsletterSub?.trim() || fallback.newsletterSub,
    heroSlides,
    banners: mergeBanners(raw?.banners, fallback.banners),
    featuredTiles: mergeFeaturedTiles(raw?.featuredTiles, fallback.featuredTiles),
  }
}
