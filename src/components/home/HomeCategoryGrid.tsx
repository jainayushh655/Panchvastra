import { Link } from 'react-router-dom'
import { categoryNameToSlug } from '@/lib/categorySlug'
import { categoryPlaceholderImage } from '@/lib/homeCategories'
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
  ]

  // Every tile is now a real category, so the section hides only when there are none.
  // (The old `<= 1` allowed for the static New Drops tile always occupying a slot.)
  if (tiles.length === 0) return null

  /*
   * The grid never opens a column it can't fill: `lg:grid-cols-3` only kicks in at 3+
   * tiles, so two categories sit evenly in a 2-column row (each getting real width and
   * no dangling empty third column) instead of being stranded on the left. A single
   * category is capped to half width and centred so it doesn't stretch full-bleed.
   */
  const gridColsClass = tiles.length >= 3 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'

  return (
    <section className="bg-white px-4 pb-6 pt-6 sm:pb-7 sm:pt-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold uppercase tracking-tight text-black sm:text-4xl">
            Shop By Category
          </h2>
        </div>

        <div
          className={`mt-6 grid grid-cols-1 gap-3 sm:mt-8 ${gridColsClass} ${
            tiles.length === 1 ? 'mx-auto max-w-sm' : ''
          }`}
        >
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
