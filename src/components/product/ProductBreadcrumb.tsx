import { Link } from 'react-router-dom'
import { categoryNameToSlug } from '@/lib/categorySlug'

/**
 * `Home / T-Shirts / Embroidery / Bamboo Piece`
 *
 * Built from the product's own category and sub-category, so each crumb links to the Shop
 * page pre-filtered the way the shopper would expect. The sub-category crumb carries the
 * category filter too — landing on "Embroidery" across every category would be a
 * different, wider result than the one the crumb promises.
 *
 * The product's own name is the current page and is therefore not a link; it is marked
 * `aria-current="page"` so assistive tech says so rather than reading a fourth link.
 */

type ProductBreadcrumbProps = {
  categoryName?: string | null
  subCategoryName?: string | null
  productName: string
}

export function ProductBreadcrumb({ categoryName, subCategoryName, productName }: ProductBreadcrumbProps) {
  const category = categoryName?.trim()
  const subCategory = subCategoryName?.trim()

  const categoryHref = category ? `/shop?category=${encodeURIComponent(categoryNameToSlug(category))}` : null
  const subCategoryHref =
    category && subCategory
      ? `/shop?category=${encodeURIComponent(categoryNameToSlug(category))}&subcategory=${encodeURIComponent(
          categoryNameToSlug(subCategory),
        )}`
      : null

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-xs text-zinc-500">
        <li>
          <Link to="/" className="transition-colors hover:text-black">
            Home
          </Link>
        </li>

        {categoryHref ? (
          <>
            <li aria-hidden>/</li>
            <li>
              <Link to={categoryHref} className="transition-colors hover:text-black">
                {category}
              </Link>
            </li>
          </>
        ) : null}

        {subCategoryHref ? (
          <>
            <li aria-hidden>/</li>
            <li>
              <Link to={subCategoryHref} className="transition-colors hover:text-black">
                {subCategory}
              </Link>
            </li>
          </>
        ) : null}

        <li aria-hidden>/</li>
        {/* `min-w-0` + truncate so a long product name cannot push the row off a 375px screen. */}
        <li aria-current="page" className="min-w-0 truncate font-semibold text-black">
          {productName}
        </li>
      </ol>
    </nav>
  )
}
