type Props = {
  images: string[]
}

function GalleryCell({
  src,
  alt,
  aspectClass,
}: {
  src: string
  alt: string
  aspectClass: string
}) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-zinc-100 dark:bg-zinc-800 ${aspectClass}`}>
      <img
        src={src}
        alt={alt}
        className="block size-full object-cover transition duration-300 hover:scale-105"
      />
    </div>
  )
}

/** PDP collage: tight gutters, no empty grid cells when fewer photos. */
export function ProductImageGallery({ images }: Props) {
  const list = images.filter(Boolean)
  if (!list.length) return null

  const top = list.slice(0, 2)
  const bottom = list.slice(2, 5)

  const topCols =
    top.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
  const bottomCols =
    bottom.length <= 1 ? 'grid-cols-1' : bottom.length === 2 ? 'grid-cols-2' : 'grid-cols-3'

  return (
    <div className="flex flex-col gap-1.5 sm:gap-2">
      <div className={`grid ${topCols} gap-1.5 sm:gap-2`}>
        {top.map((src, i) => (
          <GalleryCell
            key={`top-${i}`}
            src={src}
            alt={i === 0 ? 'Product image 1' : 'Product image 2'}
            aspectClass="aspect-[4/5]"
          />
        ))}
      </div>
      {bottom.length > 0 ? (
        <div className={`grid ${bottomCols} gap-1.5 sm:gap-2`}>
          {bottom.map((src, i) => (
            <GalleryCell
              key={`bottom-${i}`}
              src={src}
              alt={`Product image ${i + 3}`}
              aspectClass="aspect-[4/5]"
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
