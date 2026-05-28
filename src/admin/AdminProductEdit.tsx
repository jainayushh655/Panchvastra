import type { ChangeEvent, FormEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useCatalog } from '@/hooks/useCatalog'
import { getProductsSnapshot, slugify, upsertProduct } from '@/lib/catalogStore'
import { imageFileToStoredUrl } from '@/lib/cmsImageUpload'
import { EXCHANGE_HIGHLIGHT_KEY, HIGHLIGHT_CATALOG_OPTIONS, toggleHighlightKey } from '@/lib/productHighlights'
import type { Product, ShowcaseHighlight } from '@/types'

function applyShowcaseHighlight(
  highlight: ShowcaseHighlight | undefined,
): Pick<Product, 'showcaseHighlight' | 'trending' | 'isNew'> {
  if (!highlight) {
    return { showcaseHighlight: undefined, trending: false, isNew: false }
  }
  return {
    showcaseHighlight: highlight,
    trending: highlight === 'trending',
    isNew: highlight === 'newarrival',
  }
}

function inferShowcaseFromLegacy(p: Product): ShowcaseHighlight | undefined {
  if (p.showcaseHighlight) return p.showcaseHighlight
  if (p.trending) return 'trending'
  if (p.isNew) return 'newarrival'
  return undefined
}

function blank(): Product {
  return {
    id: `pv-${Date.now()}`,
    slug: '',
    name: '',
    categorySlug: 'regular-tee',
    price: 899,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['Black', 'White', 'Charcoal', 'Navy', 'Olive'],
    images: ['https://picsum.photos/seed/new-product/960/1200'],
    description: '',
    details: [],
    rating: 4.5,
    reviewCount: 0,
    popularity: 50,
    tags: [],
    highlights: [],
    ...applyShowcaseHighlight(undefined),
  }
}

export function AdminProductEdit() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { categories } = useCatalog()
  const [form, setForm] = useState<Product>(() => blank())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hoverFileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadingHover, setUploadingHover] = useState(false)
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const [hoverUploadErr, setHoverUploadErr] = useState<string | null>(null)

  useEffect(() => {
    if (!id || id === 'new') {
      setForm(blank())
      return
    }
    const existing = getProductsSnapshot().find((p) => p.id === id)
    if (existing) setForm({ ...existing, ...applyShowcaseHighlight(inferShowcaseFromLegacy(existing)) })
  }, [id])

  const save = (e: FormEvent) => {
    e.preventDefault()
    const slug =
      form.slug.trim() ||
      `${slugify(form.name)}-${form.id.slice(-4)}`
    const hoverImage = form.hoverImage?.trim()
    const patched: Product = {
      ...form,
      slug,
      images: form.images.filter(Boolean),
      hoverImage: hoverImage || undefined,
      details: form.details.filter((d) => d.trim()),
      tags: form.tags.filter((t) => t.trim()),
      groupKey: form.groupKey?.trim() || undefined,
      variantLabel: form.variantLabel?.trim() || undefined,
      colors: (form.colors ?? []).map((c) => c.trim()).filter(Boolean),
      highlights: (form.highlights ?? [])
        .map((h) => (typeof h === 'string' ? h : h.key))
        .filter((k) => k && k !== EXCHANGE_HIGHLIGHT_KEY),
      ...applyShowcaseHighlight(form.showcaseHighlight),
    }
    upsertProduct(patched)
    navigate('/admin/products')
  }

  const removeImageAt = (index: number) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }))
  }

  const onHoverImageFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setHoverUploadErr(null)
    if (!file.type.startsWith('image/')) {
      setHoverUploadErr('Only image files are allowed.')
      e.target.value = ''
      return
    }
    setUploadingHover(true)
    try {
      const url = await imageFileToStoredUrl(file)
      setForm((f) => ({ ...f, hoverImage: url }))
    } catch {
      setHoverUploadErr(`Could not read: ${file.name}`)
    } finally {
      setUploadingHover(false)
      e.target.value = ''
    }
  }

  const onImageFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target
    if (!files?.length) return
    setUploadErr(null)
    setUploading(true)
    try {
      const added: string[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) {
          setUploadErr('Only image files are allowed.')
          continue
        }
        try {
          added.push(await imageFileToStoredUrl(file))
        } catch {
          setUploadErr(`Could not read: ${file.name}`)
        }
      }
      if (added.length) {
        setForm((f) => ({ ...f, images: [...f.images, ...added] }))
      }
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const fld =
    'mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-orange-400'

  return (
    <div className="max-w-2xl pb-24">
      <Link to="/admin/products" className="text-sm font-semibold text-orange-400">
        ← Products
      </Link>
      <h1 className="type-page-title mt-4 text-white">
        {id === 'new' ? 'New product' : 'Edit product'}
      </h1>
      <form onSubmit={save} className="mt-8 space-y-5">
        <div>
          <label className="type-label">ID (stable)</label>
          <input
            className={fld}
            value={form.id}
            disabled={Boolean(id && id !== 'new')}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
          />
        </div>
        <div>
          <label className="type-label">Slug</label>
          <input
            className={fld}
            value={form.slug}
            placeholder="auto from name"
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
        </div>
        <div>
          <label className="type-label">Name</label>
          <input
            required
            className={fld}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="type-label">Category</label>
          <select
            className={fld}
            value={form.categorySlug}
            onChange={(e) => setForm({ ...form, categorySlug: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="type-label">Price ₹</label>
            <input
              type="number"
              required
              className={fld}
              value={form.price}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="type-label">Compare ₹ (optional)</label>
            <input
              type="number"
              className={fld}
              value={form.compareAtPrice ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  compareAtPrice: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>
        <div>
          <label className="type-label">Sizes (comma)</label>
          <input
            className={fld}
            value={form.sizes.join(', ')}
            onChange={(e) =>
              setForm({
                ...form,
                sizes: e.target.value
                  .split(',')
                  .map((s) => s.trim().toUpperCase())
                  .filter(Boolean),
              })
            }
          />
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
          <label className="type-label text-orange-400">Variant group (PDP)</label>
          <p className="mt-1 text-xs text-zinc-500">
            Products with the same group key appear together on the product page (like Amazon). Create one
            catalog product per color/style, then give them the same key (e.g. <code className="text-zinc-400">tshirt-001</code>
            ).
          </p>
          <label className="mt-4 block text-xs font-semibold uppercase text-zinc-500">
            Group key
            <input
              className={fld}
              value={form.groupKey ?? ''}
              placeholder="tshirt-001"
              onChange={(e) => setForm({ ...form, groupKey: e.target.value })}
            />
          </label>
          <label className="mt-3 block text-xs font-semibold uppercase text-zinc-500">
            Variant label (thumbnail)
            <input
              className={fld}
              value={form.variantLabel ?? ''}
              placeholder="Black, White, Sage…"
              onChange={(e) => setForm({ ...form, variantLabel: e.target.value })}
            />
          </label>
        </div>
        <div>
          <label className="type-label">Colors (comma)</label>
          <input
            className={fld}
            value={(form.colors ?? []).join(', ')}
            placeholder="Optional. Ignored on PDP when variant group has 2+ products — use separate products per color instead."
            onChange={(e) =>
              setForm({
                ...form,
                colors: e.target.value
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </div>
        <div>
          <label className="type-label">Images</label>
          <p className="mt-1 text-xs text-zinc-500">
            Upload from your device or paste image URLs below. Uploads are saved in this browser as data (localStorage);
            large galleries may hit browser limits — we resize wide photos automatically.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            aria-label="Upload product images"
            onChange={onImageFiles}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? 'Processing…' : 'Upload from computer'}
            </Button>
            {uploadErr ? <span className="text-xs text-red-400">{uploadErr}</span> : null}
          </div>
          {form.images.length > 0 ? (
            <ul className="mt-4 flex flex-wrap gap-3">
              {form.images.map((src, i) => (
                <li key={i} className="relative">
                  <img
                    src={src}
                    alt=""
                    className="h-24 w-20 rounded-lg border border-zinc-600 object-cover"
                  />
                  <button
                    type="button"
                    aria-label={`Remove image ${i + 1}`}
                    className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-red-600 text-sm font-bold text-white shadow hover:bg-red-500"
                    onClick={() => removeImageAt(i)}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="mt-4 text-xs font-semibold uppercase text-zinc-500">Image URLs (optional)</p>
          <textarea
            className={`${fld} mt-2 min-h-[88px]`}
            placeholder={'https://…\nOne URL per line (optional, if not uploading)'}
            value={form.images.join('\n')}
            onChange={(e) =>
              setForm({
                ...form,
                images: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean),
              })
            }
          />
        </div>
        <div>
          <label className="type-label">Hover image (shop grid)</label>
          <p className="mt-1 text-xs text-zinc-500">
            Shown when shoppers hover a product card on the shop and home grids. Uses the first gallery image
            until you set this.
          </p>
          <input
            ref={hoverFileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Upload hover image"
            onChange={onHoverImageFile}
          />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={uploadingHover}
              onClick={() => hoverFileInputRef.current?.click()}
            >
              {uploadingHover ? 'Processing…' : 'Upload hover image'}
            </Button>
            {form.hoverImage ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setForm((f) => ({ ...f, hoverImage: undefined }))}
              >
                Remove hover image
              </Button>
            ) : null}
            {hoverUploadErr ? <span className="text-xs text-red-400">{hoverUploadErr}</span> : null}
          </div>
          {form.hoverImage ? (
            <div className="mt-4 flex flex-wrap items-start gap-4">
              <div className="relative">
                <img
                  src={form.hoverImage}
                  alt="Hover preview"
                  className="h-24 w-20 rounded-lg border border-orange-500/50 object-cover"
                />
                <span className="absolute -bottom-2 left-0 rounded bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-zinc-950">
                  Hover
                </span>
              </div>
              {form.images[0] ? (
                <div className="relative opacity-70">
                  <img
                    src={form.images[0]}
                    alt="Main preview"
                    className="h-24 w-20 rounded-lg border border-zinc-600 object-cover"
                  />
                  <span className="absolute -bottom-2 left-0 rounded bg-zinc-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    Main
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
          <p className="mt-4 text-xs font-semibold uppercase text-zinc-500">Hover image URL (optional)</p>
          <input
            type="url"
            className={fld}
            placeholder="https://…"
            value={form.hoverImage ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                hoverImage: e.target.value.trim() || undefined,
              })
            }
          />
        </div>
        <div>
          <label className="type-label">Description</label>
          <textarea
            required
            className={`${fld} min-h-[88px]`}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div>
          <label className="type-label">Details bullets (newline)</label>
          <textarea
            className={`${fld} min-h-[72px]`}
            value={form.details.join('\n')}
            onChange={(e) =>
              setForm({ ...form, details: e.target.value.split('\n').map((s) => s.trim()) })
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="type-label">Rating</label>
            <input
              type="number"
              step="0.1"
              className={fld}
              value={form.rating}
              onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="type-label">Reviews count</label>
            <input
              type="number"
              className={fld}
              value={form.reviewCount}
              onChange={(e) => setForm({ ...form, reviewCount: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="type-label">Popularity 0–100</label>
            <input
              type="number"
              className={fld}
              value={form.popularity}
              onChange={(e) => setForm({ ...form, popularity: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="type-label">Sale % (optional)</label>
            <input
              type="number"
              className={fld}
              value={form.salePct ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  salePct: e.target.value ? Number(e.target.value) : undefined,
                })
              }
            />
          </div>
        </div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-4">
          <label htmlFor="showcase-highlight" className="text-xs font-bold uppercase text-orange-400">
            Home — Curated row
          </label>
          <p className="mt-1 text-[11px] text-zinc-500">
            At most one: this product is pinned to that tab on the storefront home page. Remaining slots use
            automatic rules. Choose “None” to unpick.
          </p>
          <select
            id="showcase-highlight"
            className={`${fld} mt-3`}
            value={form.showcaseHighlight ?? ''}
            onChange={(e) => {
              const raw = e.target.value as ShowcaseHighlight | ''
              const next = raw === '' ? undefined : raw
              setForm((f) => ({ ...f, ...applyShowcaseHighlight(next) }))
            }}
          >
            <option value="">None</option>
            <option value="trending">Trending</option>
            <option value="bestseller">Best seller</option>
            <option value="newarrival">New arrival</option>
            <option value="hotdeals">Hot deals</option>
          </select>
        </div>
        <div>
          <label className="type-label">Key highlights</label>
          <p className="mt-1 text-[11px] text-zinc-500">
            Shown on the product page. &quot;7 Days Exchange Policy&quot; is added automatically for every product.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {HIGHLIGHT_CATALOG_OPTIONS.map((opt) => {
              const selected = (form.highlights ?? []).some(
                (h) => (typeof h === 'string' ? h : h.key) === opt.key,
              )
              return (
                <label
                  key={opt.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-zinc-600"
                >
                  <input
                    type="checkbox"
                    className="accent-orange-500"
                    checked={selected}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        highlights: toggleHighlightKey(
                          (f.highlights ?? []).map((h) => (typeof h === 'string' ? h : h.key)),
                          opt.key,
                        ),
                      }))
                    }
                  />
                  {opt.label}
                </label>
              )
            })}
          </div>
        </div>
        <div>
          <label className="type-label">Tags (comma)</label>
          <input
            className={fld}
            value={form.tags.join(', ')}
            onChange={(e) =>
              setForm({
                ...form,
                tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean),
              })
            }
          />
        </div>
        <Button type="submit" size="lg">
          Save product
        </Button>
      </form>
    </div>
  )
}
