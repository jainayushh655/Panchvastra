import type { HomepageHeroSlide } from '@/types/homepage'

/**
 * The hero's editorial copy blocks.
 *
 * Ported from the Vite application's `lib/homepageHero.ts` + `lib/defaultHomepage.ts`,
 * which the homepage reads through `defaultHomepage().heroSlides`. Three things about
 * what is here, and what is not:
 *
 * 1. ONLY THE SLIDES ARE PORTED, not the whole `defaultHomepage()` object. The homepage
 *    reads exactly one field of it — `heroSlides` — and every other field
 *    (`featuredTiles`, `banners`, `newsletterTitle`, the deprecated single-hero fields)
 *    is dead on the current homepage: no component renders them. Porting them would be
 *    copying unreachable content into a new codebase.
 *
 * 2. ONLY `primaryCta` AND `id` ARE ACTUALLY RENDERED. `HeroCarousel` draws one centred
 *    call to action per slide and nothing else — the eyebrow, title and sub were removed
 *    from the hero before this migration. They are kept on the type and in the data
 *    because the type is shared and the admin payload still carries them; they are simply
 *    not displayed, exactly as today.
 *
 * 3. `backgroundImage` IS DELIBERATELY ABSENT. The Vite version sets every slide's
 *    background to `/images/home/panchvastra-hero-editorial.svg`, a file that does not
 *    exist in the repository — and it never renders, because the homepage overrides the
 *    field on every code path: it becomes the admin's `image_url` when the carousel API
 *    returns images, and an explicit `undefined` when it returns none. Carrying a
 *    reference to a missing asset into this app would add a dead 404 path, so it is left
 *    out. The rendered result is identical.
 *
 * `sectionClassName` and `tone` are likewise unused by the current hero and kept only to
 * satisfy the shared type.
 */

/** Fixed homepage carousel size, matching the Vite constant. */
export const HERO_SLIDE_COUNT = 3

/**
 * Every hero slide shows the same call to action, so it is defined once. These are the
 * destination and label the hero uses today.
 */
const HERO_PRIMARY_CTA = { label: 'Shop now', to: '/shop?sort=new-arrival' }
const HERO_SECONDARY_CTA = { label: 'Our story', to: '/about' }

export function defaultHeroSlides(): HomepageHeroSlide[] {
  return [
    {
      id: 'new-design',
      eyebrow: 'Spotlight',
      title: 'New\nArrivals',
      sub: 'Fresh cuts, raw dye stories, and hardware details — built for the feed and for everyday rotation.',
      tone: 'dark',
      sectionClassName: 'border-zinc-800 bg-[#050505]',
      primaryCta: HERO_PRIMARY_CTA,
      secondaryCta: HERO_SECONDARY_CTA,
    },
    {
      id: 'combo',
      eyebrow: 'Build a fit',
      title: 'Combo',
      sub: 'Pair tees with shorts and stack silhouettes — curated bundles for better value on full looks.',
      tone: 'dark',
      sectionClassName: 'border-zinc-800 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black',
      primaryCta: HERO_PRIMARY_CTA,
      secondaryCta: HERO_SECONDARY_CTA,
    },
    {
      id: 'exhibitions',
      eyebrow: 'In real life',
      title: 'Exhibitions',
      sub: 'Pop-ups, art walls, and community drops. See where PANCHVASTRA lands next and join the line.',
      tone: 'dark',
      sectionClassName: 'border-zinc-800 bg-[#050505]',
      primaryCta: HERO_PRIMARY_CTA,
      secondaryCta: HERO_SECONDARY_CTA,
    },
  ]
}
