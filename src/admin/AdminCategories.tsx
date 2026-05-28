import type { FormEvent } from 'react'
import { useEffect, useState } from 'react'
import { useCatalog } from '@/hooks/useCatalog'
import type { CategoryDef } from '@/types'
import { setCategoriesBulk } from '@/lib/catalogStore'
import { Button } from '@/components/ui/Button'

export function AdminCategories() {
  const { categories } = useCatalog()
  const [draft, setDraft] = useState<CategoryDef[]>(() => categories.map((c) => ({ ...c })))

  useEffect(() => {
    setDraft(categories.map((c) => ({ ...c })))
  }, [categories])

  const upsertRows = draft.map((row, ix) => (
    <div key={`${row.slug}-${String(ix)}`} className="grid gap-3 border-b border-zinc-800 py-4 sm:grid-cols-[1fr_1fr_140px]">
      <input
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm font-mono text-white"
        value={row.slug}
        placeholder="slug-here"
        onChange={(e) => {
          const next = [...draft]
          next[ix] = { ...row, slug: e.target.value }
          setDraft(next)
        }}
      />
      <input
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
        value={row.label}
        onChange={(e) => {
          const next = [...draft]
          next[ix] = { ...row, label: e.target.value }
          setDraft(next)
        }}
      />
      <input
        className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
        value={row.shortLabel}
        onChange={(e) => {
          const next = [...draft]
          next[ix] = { ...row, shortLabel: e.target.value }
          setDraft(next)
        }}
      />
    </div>
  ))

  const saveAll = (e: FormEvent) => {
    e.preventDefault()
    const slugs = new Set<string>()
    for (const c of draft) {
      if (!c.slug.trim()) {
        alert('Every row needs a slug')
        return
      }
      const s = c.slug.trim()
      if (slugs.has(s)) {
        alert('Duplicate slug')
        return
      }
      slugs.add(s)
    }
    setCategoriesBulk(draft.map((c) => ({ ...c, slug: c.slug.trim() })))
  }

  const addRow = () => setDraft([...draft, { slug: '', label: '', shortLabel: '' }])

  return (
    <div className="max-w-4xl">
      <h1 className="type-page-title text-white">Categories</h1>
      <p className="mt-2 text-sm text-zinc-400">Slugs tie to filters & PDP — add new silhouettes anytime.</p>
      <form onSubmit={saveAll} className="mt-10">
        <div className="mb-4 grid gap-3 text-[10px] font-bold uppercase tracking-wider text-zinc-500 sm:grid-cols-[1fr_1fr_140px]">
          <span>Slug</span>
          <span>Full label</span>
          <span>Short label</span>
        </div>
        {upsertRows}
        <Button type="button" variant="ghost" className="mt-4 dark:!border-zinc-700" onClick={addRow}>
          + Category
        </Button>
        <Button type="submit" className="ml-4 mt-4">
          Save all
        </Button>
      </form>
    </div>
  )
}
