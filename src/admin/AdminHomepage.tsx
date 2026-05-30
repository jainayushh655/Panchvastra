import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useCatalog } from '@/hooks/useCatalog'
import { imageFileToStoredUrl } from '@/lib/cmsImageUpload'
import { defaultHomepage, setHomepageBulk } from '@/lib/catalogStore'
import { HERO_SLIDE_COUNT, normalizeHomepageContent, sanitizeHeroSlides } from '@/lib/homepageHero'
import type { HomepageContent, HomepageHeroSlide } from '@/types/homepage'
import { Button } from '@/components/ui/Button'

const SLIDE_LABELS = ['New Arrivals', 'Combo', 'Exhibitions'] as const

const fld =
  'mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400'

export function AdminHomepage() {
  const { homepage } = useCatalog()
  const [d, setD] = useState<HomepageContent>(homepage)
  const [uploadingIx, setUploadingIx] = useState<number | null>(null)
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({})

  useEffect(() => {
    setD(structuredClone(normalizeHomepageContent(homepage, defaultHomepage())))
  }, [homepage])

  const patch = (next: HomepageContent) => setD(next)

  const patchSlide = (ix: number, partial: Partial<HomepageHeroSlide>) => {
    const slides = [...d.heroSlides]
    slides[ix] = { ...slides[ix], ...partial }
    patch({ ...d, heroSlides: slides })
  }

  const patchSlideCta = (
    ix: number,
    which: 'primaryCta' | 'secondaryCta',
    field: 'label' | 'to',
    value: string,
  ) => {
    const slides = [...d.heroSlides]
    const slide = slides[ix]
    if (which === 'primaryCta') {
      slides[ix] = { ...slide, primaryCta: { ...slide.primaryCta, [field]: value } }
    } else {
      const prev = slide.secondaryCta ?? { label: '', to: '' }
      slides[ix] = { ...slide, secondaryCta: { ...prev, [field]: value } }
    }
    patch({ ...d, heroSlides: slides })
  }

  const onBgImageFile = async (ix: number, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadErr(null)
    if (!file.type.startsWith('image/')) {
      setUploadErr('Only image files are allowed.')
      e.target.value = ''
      return
    }
    setUploadingIx(ix)
    try {
      const url = await imageFileToStoredUrl(file)
      patchSlide(ix, { backgroundImage: url })
    } catch {
      setUploadErr(`Could not read: ${file.name}`)
    } finally {
      setUploadingIx(null)
      e.target.value = ''
    }
  }

  const tile = (
    ix: number,
    key: keyof HomepageContent['featuredTiles'][number],
    value: string,
  ) => {
    const tiles = [...d.featuredTiles]
    tiles[ix] = { ...tiles[ix], [key]: value }
    patch({ ...d, featuredTiles: tiles })
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    const heroSlides = sanitizeHeroSlides(d.heroSlides)
    setHomepageBulk({
      ...d,
      heroSlides,
      heroEyebrow: heroSlides[0].eyebrow,
      heroTitle: heroSlides[0].title,
      heroSub: heroSlides[0].sub,
    })
  }

  return (
    <div className="max-w-3xl pb-24">
      <h1 className="type-page-title text-white">Homepage CMS</h1>
      <form onSubmit={save} className="mt-8 space-y-10">
        <section className="space-y-6">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">
              Hero carousel ({HERO_SLIDE_COUNT} slides)
            </h2>
            <p className="mt-1 text-xs text-zinc-500">
              Same three slides as the storefront home page. Edit copy and background images here, then
              publish.
            </p>
          </div>

          {d.heroSlides.slice(0, HERO_SLIDE_COUNT).map((slide, ix) => (
            <div key={slide.id} className="rounded-2xl border border-zinc-800 p-4">
              <p className="text-[10px] font-bold uppercase text-orange-400">
                Slide {ix + 1} — {SLIDE_LABELS[ix] ?? `Slide ${ix + 1}`}
              </p>
              <Field label="Eyebrow" value={slide.eyebrow} on={(v) => patchSlide(ix, { eyebrow: v })} fld={fld} />
              <Field label="Title" value={slide.title} on={(v) => patchSlide(ix, { title: v })} fld={fld} />
              <Field label="Subtitle" value={slide.sub} on={(v) => patchSlide(ix, { sub: v })} fld={fld} multiline />

              <label className="mt-3 block text-xs font-semibold uppercase text-zinc-500">
                Text tone
                <select
                  className={fld}
                  value={slide.tone}
                  onChange={(e) => patchSlide(ix, { tone: e.target.value as 'light' | 'dark' })}
                >
                  <option value="light">Light background / dark text</option>
                  <option value="dark">Dark background / light text</option>
                </select>
              </label>

              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="text-xs font-bold uppercase text-zinc-500">Background image</p>
                <input
                  ref={(el) => {
                    fileRefs.current[ix] = el
                  }}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  aria-label={`Upload background for slide ${ix + 1}`}
                  onChange={(e) => onBgImageFile(ix, e)}
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uploadingIx === ix}
                    onClick={() => fileRefs.current[ix]?.click()}
                  >
                    {uploadingIx === ix ? 'Processing…' : 'Upload background'}
                  </Button>
                  {slide.backgroundImage ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => patchSlide(ix, { backgroundImage: undefined })}
                    >
                      Remove image
                    </Button>
                  ) : null}
                </div>
                {slide.backgroundImage ? (
                  <img
                    src={slide.backgroundImage}
                    alt=""
                    className="mt-3 h-28 w-full max-w-sm rounded-lg border border-zinc-700 object-cover"
                  />
                ) : null}
                <label className="mt-3 block text-xs font-semibold uppercase text-zinc-500">
                  Image URL (optional)
                  <input
                    className={fld}
                    placeholder="https://… or /images/hero.jpg"
                    value={slide.backgroundImage ?? ''}
                    onChange={(e) =>
                      patchSlide(ix, { backgroundImage: e.target.value.trim() || undefined })
                    }
                  />
                </label>
              </div>

              <Field
                label="Gradient fallback (Tailwind classes, used when no image)"
                value={slide.sectionClassName}
                on={(v) => patchSlide(ix, { sectionClassName: v })}
                fld={fld}
              />

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field
                  label="Primary CTA label"
                  value={slide.primaryCta.label}
                  on={(v) => patchSlideCta(ix, 'primaryCta', 'label', v)}
                  fld={fld}
                />
                <Field
                  label="Primary CTA link"
                  value={slide.primaryCta.to}
                  on={(v) => patchSlideCta(ix, 'primaryCta', 'to', v)}
                  fld={fld}
                />
                <Field
                  label="Secondary CTA label (optional)"
                  value={slide.secondaryCta?.label ?? ''}
                  on={(v) => patchSlideCta(ix, 'secondaryCta', 'label', v)}
                  fld={fld}
                />
                <Field
                  label="Secondary CTA link"
                  value={slide.secondaryCta?.to ?? ''}
                  on={(v) => patchSlideCta(ix, 'secondaryCta', 'to', v)}
                  fld={fld}
                />
              </div>
            </div>
          ))}
          {uploadErr ? <p className="text-xs text-red-400">{uploadErr}</p> : null}
        </section>

        <section className="space-y-8">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Featured section</h2>
            <label className="mt-4 block text-xs font-semibold uppercase text-zinc-500">
              Heading
              <input
                className={fld}
                value={d.featuredSectionTitle}
                onChange={(e) => patch({ ...d, featuredSectionTitle: e.target.value })}
              />
            </label>
          </div>
          {d.featuredTiles.map((t, ix) => (
            <div key={`tile-${String(ix)}`} className="rounded-2xl border border-zinc-800 p-4">
              <p className="text-[10px] font-bold uppercase text-orange-400">Tile {ix + 1}</p>
              <Field label="Shop slug (?category=)" value={t.slug} on={(v) => tile(ix, 'slug', v)} fld={fld} />
              <Field label="Title" value={t.title} on={(v) => tile(ix, 'title', v)} fld={fld} />
              <Field label="Blurb" value={t.blurb} on={(v) => tile(ix, 'blurb', v)} fld={fld} />
              <Field label="Badge" value={t.badge} on={(v) => tile(ix, 'badge', v)} fld={fld} />
              <Field
                label="Bg gradient classes"
                value={t.bgClass}
                on={(v) => tile(ix, 'bgClass', v)}
                fld={fld}
              />
            </div>
          ))}
        </section>

        <section>
          <label className="text-xs font-bold uppercase text-zinc-500">
            Trending section title
            <input
              className={fld}
              value={d.trendingSectionTitle}
              onChange={(e) => patch({ ...d, trendingSectionTitle: e.target.value })}
            />
          </label>
        </section>

        <section className="grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-800 p-4">
            <h3 className="text-xs font-bold uppercase text-orange-400">Banner — sale</h3>
            <Field
              label="Eyebrow"
              value={d.banners.sale.eyebrow}
              on={(v) =>
                patch({ ...d, banners: { ...d.banners, sale: { ...d.banners.sale, eyebrow: v } } })
              }
              fld={fld}
            />
            <Field
              label="Title"
              value={d.banners.sale.title}
              on={(v) =>
                patch({ ...d, banners: { ...d.banners, sale: { ...d.banners.sale, title: v } } })
              }
              fld={fld}
            />
            <Field
              label="Sub"
              value={d.banners.sale.sub}
              on={(v) =>
                patch({ ...d, banners: { ...d.banners, sale: { ...d.banners.sale, sub: v } } })
              }
              fld={fld}
            />
            <Field
              label="CTA"
              value={d.banners.sale.cta}
              on={(v) =>
                patch({ ...d, banners: { ...d.banners, sale: { ...d.banners.sale, cta: v } } })
              }
              fld={fld}
            />
            <Field
              label="Link path"
              value={d.banners.sale.link}
              on={(v) =>
                patch({ ...d, banners: { ...d.banners, sale: { ...d.banners.sale, link: v } } })
              }
              fld={fld}
            />
          </div>
          <div className="rounded-2xl border border-zinc-800 p-4">
            <h3 className="text-xs font-bold uppercase text-orange-400">Banner — arrivals</h3>
            <Field
              label="Eyebrow"
              value={d.banners.arrivals.eyebrow}
              on={(v) =>
                patch({
                  ...d,
                  banners: { ...d.banners, arrivals: { ...d.banners.arrivals, eyebrow: v } },
                })
              }
              fld={fld}
            />
            <Field
              label="Title"
              value={d.banners.arrivals.title}
              on={(v) =>
                patch({
                  ...d,
                  banners: { ...d.banners, arrivals: { ...d.banners.arrivals, title: v } },
                })
              }
              fld={fld}
            />
            <Field
              label="Sub"
              value={d.banners.arrivals.sub}
              on={(v) =>
                patch({
                  ...d,
                  banners: { ...d.banners, arrivals: { ...d.banners.arrivals, sub: v } },
                })
              }
              fld={fld}
              multiline
            />
            <Field
              label="CTA"
              value={d.banners.arrivals.cta}
              on={(v) =>
                patch({
                  ...d,
                  banners: { ...d.banners, arrivals: { ...d.banners.arrivals, cta: v } },
                })
              }
              fld={fld}
            />
            <Field
              label="Link path"
              value={d.banners.arrivals.link}
              on={(v) =>
                patch({
                  ...d,
                  banners: { ...d.banners, arrivals: { ...d.banners.arrivals, link: v } },
                })
              }
              fld={fld}
            />
          </div>
        </section>

        <section>
          <label className="text-xs font-bold uppercase text-zinc-500">
            Newsletter title
            <input
              className={fld}
              value={d.newsletterTitle}
              onChange={(e) => patch({ ...d, newsletterTitle: e.target.value })}
            />
          </label>
          <label className="mt-4 block text-xs font-bold uppercase text-zinc-500">
            Newsletter sub
            <textarea
              className={`${fld} min-h-[72px]`}
              value={d.newsletterSub}
              onChange={(e) => patch({ ...d, newsletterSub: e.target.value })}
            />
          </label>
        </section>

        <Button type="submit" size="lg">
          Publish homepage
        </Button>
      </form>
    </div>
  )
}

function Field({
  label,
  value,
  on,
  fld,
  multiline,
}: {
  label: string
  value: string
  on: (v: string) => void
  fld: string
  multiline?: boolean
}) {
  return (
    <label className="mt-3 block text-xs font-semibold uppercase text-zinc-500">
      {label}
      {multiline ? (
        <textarea className={`${fld} min-h-[80px]`} value={value} onChange={(e) => on(e.target.value)} />
      ) : (
        <input className={fld} value={value} onChange={(e) => on(e.target.value)} />
      )}
    </label>
  )
}
