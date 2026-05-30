import { defaultHeroSlides } from '@/lib/homepageHero'
import type { HomepageContent } from '@/types/homepage'

export function defaultHomepage(): HomepageContent {
  return {
    heroEyebrow: 'Gen Z · India-first',
    heroTitle: 'Built for fits that live on feed & off it.',
    heroSub:
      'PANCHVASTRA is modular streetwear: regular tees, oversized silhouettes, and shorts — with room to grow into whatever the algorithm wants next.',
    heroSlides: defaultHeroSlides(),
    featuredSectionTitle: 'Featured drops',
    trendingSectionTitle: 'Trending now',
    featuredTiles: [
      {
        slug: 'oversized-tee',
        title: 'Oversized',
        blurb: 'Drop shoulders & longline drape',
        badge: 'Line',
        bgClass: 'from-violet-900/30 to-zinc-900',
      },
      {
        slug: 'regular-tee',
        title: 'Regular',
        blurb: 'Daily rotation staples',
        badge: 'Core',
        bgClass: 'from-orange-900/25 to-zinc-900',
      },
      {
        slug: 'shorts',
        title: 'Shorts',
        blurb: 'Tech fleece & swim hybrids',
        badge: 'Line',
        bgClass: 'from-emerald-900/25 to-zinc-900',
      },
    ],
    banners: {
      sale: {
        eyebrow: 'Sale',
        title: 'End of season — up to 25% off',
        sub: 'Core staples & shorts while stock lasts.',
        cta: 'Shop sale →',
        link: '/shop',
      },
      arrivals: {
        eyebrow: 'New arrivals',
        title: 'Acid wash + neon mist',
        sub: "Micro-drops that won't restock.",
        cta: 'See new →',
        link: '/shop?q=acid',
      },
    },
    newsletterTitle: 'Join the list',
    newsletterSub: 'Early access to collabs & restocks. No spam — we respect the inbox.',
  }
}
