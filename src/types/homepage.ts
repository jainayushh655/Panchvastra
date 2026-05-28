/** CMS-driven homepage slices — persisted with catalog in localStorage */

export interface HomepageHeroSlide {
  id: string
  eyebrow: string
  title: string
  sub: string
  /** Full-bleed background (URL or data URL from admin upload). */
  backgroundImage?: string
  /** Fallback background when no image is set (Tailwind classes). */
  sectionClassName: string
  tone: 'light' | 'dark'
  primaryCta: { label: string; to: string }
  secondaryCta?: { label: string; to: string }
}

export interface HomepageFeaturedTile {
  slug: string
  title: string
  blurb: string
  badge: string
  /** Tailwind gradient classes (dark theme cards) */
  bgClass: string
}

export interface HomepageBannerPair {
  sale: {
    eyebrow: string
    title: string
    sub: string
    cta: string
    link: string
  }
  arrivals: {
    eyebrow: string
    title: string
    sub: string
    cta: string
    link: string
  }
}

export interface HomepageContent {
  /** @deprecated Legacy single hero — migrated into heroSlides on load */
  heroEyebrow: string
  /** @deprecated Legacy single hero — migrated into heroSlides on load */
  heroTitle: string
  /** @deprecated Legacy single hero — migrated into heroSlides on load */
  heroSub: string
  heroSlides: HomepageHeroSlide[]
  featuredSectionTitle: string
  featuredTiles: HomepageFeaturedTile[]
  trendingSectionTitle: string
  banners: HomepageBannerPair
  newsletterTitle: string
  newsletterSub: string
}
