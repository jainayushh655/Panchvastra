import { Link } from 'react-router-dom'
import { categoryNameToSlug } from '@/lib/categorySlug'
import { categoryPlaceholderImage, NEW_DROPS_TILE } from '@/lib/homeCategories'
import type { CategoryDto } from '@/types/api/CategoryDto'

type Tile = {
  key: string
  label: string
  to: string
  image: string
}

export function HomeCategoryGrid({ categories }: { categories: CategoryDto[] }) {
  const tiles: Tile[] = [
    ...categories.map((c) => {
      const slug = categoryNameToSlug(c.name)
      return {
        key: slug,
        label: c.name,
        to: `/shop?category=${slug}`,
        image: c.image_url?.trim() || categoryPlaceholderImage(slug),
      }
    }),
    { key: 'new-drops', ...NEW_DROPS_TILE },
  ]

  if (tiles.length <= 1) return null

  return (
    <section className="bg-[#f5f5f3] px-4 py-14 sm:py-20">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">Shop By Category</p>
          <h2 className="mt-2 font-display text-3xl font-bold uppercase tracking-tight text-black sm:text-4xl">
            Category Edit
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) => (
            <CategoryTile key={tile.key} tile={tile} />
          ))}
        </div>
      </div>
    </section>
  )
}

function CategoryTile({ tile }: { tile: Tile }) {
  return (
    <Link
      to={tile.to}
      aria-label={`Shop ${tile.label}`}
      className="group relative block aspect-[4/3] w-full overflow-hidden border border-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-black"
    >
      <img
        src={tile.image}
        alt=""
        aria-hidden
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
      />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" aria-hidden />
      <p className="absolute bottom-0 left-0 p-4 font-display text-lg font-bold uppercase tracking-wide text-white sm:text-xl">
        {tile.label}
      </p>
    </Link>
  )
}
